import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { DeepPartial, EntityManager } from 'typeorm';

import {
  getClearRefreshCookieOptions,
  getRefreshCookieName,
} from '@/config/cookie.config';

import { UserEntity, createUserMetadata } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { UserAddressEntity } from '../entities/address.entity';
import { AccountStatusRepository } from '../../library/repositories/accountstatus.repository';
import {
  ACCOUNT_STATUS_KEYS,
  AccountStatusKey,
} from '@/config/statuses.config';
import { AccountStatusEntity } from '../../library/entities/accountstatus.entity';
import { ROLE_KEYS } from '../../library/seeders/role.seeder';
import { RoleEntity } from '../../library/entities/role.entity';
import { RoleRepository } from '../../library/repositories/role.repository';
import { UserPhoneEntity } from '../entities/phone.entity';

type UpdateUserOptions = {
  touchLastUpdatedAt?: boolean;
  lastUpdatedAt?: Date | null;
};

@Injectable()
export class UserService {
  public constructor(
    private readonly userRepo: UserRepository,
    private readonly roleRepo: RoleRepository,
    private readonly statusRepo: AccountStatusRepository,
  ) {}

  public async validateUser(
    email: string,
    password: string,
  ): Promise<UserEntity> {
    const user: UserEntity | null = await this.userRepo.findByEmail(email);

    if (!user?.identity?.password)
      throw new UnauthorizedException('Invalid credentials');

    const isMatch: boolean = await bcrypt.compare(
      password,
      user.identity.password,
    );

    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  public hasPermission(user: UserEntity, keys: string[]): void {
    const userPermissions: Set<string> = new Set(
      user.roles?.flatMap(
        (role) => role.permissions?.map((permission) => permission.key) ?? [],
      ) ?? [],
    );

    const hasPermission: boolean = keys.some((key: string) =>
      userPermissions.has(key),
    );

    if (!hasPermission)
      throw new ForbiddenException('User does not have required permission');
  }

  public canAuthenticate(user: UserEntity): boolean {
    return user.status?.key === ACCOUNT_STATUS_KEYS.ACTIVE;
  }

  public assertCanAuthenticate(user: UserEntity): void {
    if (this.canAuthenticate(user)) return;

    throw new ForbiddenException('Account is not active.');
  }

  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  public async deleteAddress(
    address: UserAddressEntity,
    manager: EntityManager = this.userRepo.manager,
  ): Promise<void> {
    await manager.delete(UserAddressEntity, {
      id: address.id,
    });
  }

  public async clearProfileAvatar(
    profileId: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (manager)
      return this.userRepo.clearProfileAvatarWithManager(profileId, manager);
    await this.userRepo.clearProfileAvatar(profileId);
  }

  public async findByIdOrFail(id: string): Promise<UserEntity> {
    return this.userRepo.findByIdOrFail(id);
  }

  public async updateUser(
    user: UserEntity,
    dto: DeepPartial<UserEntity>,
    options: UpdateUserOptions = {},
    manager?: EntityManager,
  ): Promise<UserEntity> {
    const shouldTouchLastUpdatedAt: boolean =
      options.touchLastUpdatedAt ?? true;

    const dtoMetadata = dto.metadata as
      | Partial<UserEntity['metadata']>
      | undefined;

    const metadata = shouldTouchLastUpdatedAt
      ? createUserMetadata({
          ...user.metadata,
          ...(dtoMetadata ?? {}),
          last_updated_at:
            options.lastUpdatedAt ?? dtoMetadata?.last_updated_at ?? new Date(),
        })
      : dtoMetadata;

    const repository = manager
      ? manager.getRepository(UserEntity)
      : this.userRepo;
    const updatedUser: UserEntity = repository.merge(user, {
      ...dto,
      ...(metadata ? { metadata } : {}),
    });

    await repository.save(updatedUser);

    return manager
      ? manager.findOneOrFail(UserEntity, { where: { id: user.id } })
      : this.userRepo.findByIdOrFail(user.id);
  }

  public async updateMetadata(
    user: UserEntity,
    metadata: Partial<UserEntity['metadata']>,
  ): Promise<UserEntity> {
    const current = await this.userRepo.findByIdOrFail(user.id);

    return this.updateUser(current, {
      metadata: createUserMetadata({
        ...current.metadata,
        ...metadata,
      }),
    });
  }

  public async recordSignIn(user: UserEntity): Promise<UserEntity> {
    return this.updateMetadata(user, { last_sign_in: new Date() });
  }

  public async recordEmailChanged(user: UserEntity): Promise<UserEntity> {
    return this.updateMetadata(user, {
      last_changed_email: new Date(),
    });
  }

  public async recordPasswordChanged(user: UserEntity): Promise<UserEntity> {
    return this.updateMetadata(user, {
      last_changed_password: new Date(),
    });
  }

  public async deleteUser(user: UserEntity, res: Response): Promise<void> {
    await this.userRepo.removeUser(user.id);

    res.clearCookie(getRefreshCookieName(), getClearRefreshCookieOptions());
  }

  private async getDefaultAccountStatus(): Promise<AccountStatusEntity> {
    const status: AccountStatusEntity | null = await this.statusRepo.findOne({
      where: { key: ACCOUNT_STATUS_KEYS.ACTIVE },
    });

    if (!status)
      throw new InternalServerErrorException(
        'Default active account status is not seeded.',
      );

    return status;
  }

  private async getDefaultUserRole(): Promise<RoleEntity> {
    const role: RoleEntity | null = await this.roleRepo.findOne({
      where: { key: ROLE_KEYS.USER },
    });

    if (!role)
      throw new InternalServerErrorException(
        'Default user role is not seeded.',
      );

    return role;
  }

  public async createUser(input: DeepPartial<UserEntity>): Promise<UserEntity> {
    const email: string | undefined = input.identity?.email;

    if (!email)
      throw new InternalServerErrorException(
        'Cannot create user without an email address.',
      );

    const existingUser: UserEntity | null =
      await this.userRepo.findByEmail(email);

    if (existingUser)
      throw new ConflictException('A user with this email already exists.');

    const status: AccountStatusEntity = await this.getDefaultAccountStatus();
    const role: RoleEntity = await this.getDefaultUserRole();
    const user: UserEntity = await this.userRepo.createUser({
      ...input,
      status: { id: status.id },
      roles: [role],
      metadata: createUserMetadata(),
    });

    return this.userRepo.findByIdOrFail(user.id);
  }

  public async updateUserStatusByKey(
    user: UserEntity,
    key: AccountStatusKey,
  ): Promise<UserEntity> {
    const status: AccountStatusEntity | null = await this.statusRepo.findOne({
      where: { key },
    });

    if (!status)
      throw new InternalServerErrorException(
        `Account status "${key}" is not seeded.`,
      );

    const updated: UserEntity = await this.updateUser(user, {
      status: { id: status.id },
    });

    await this.userRepo.incrementTokenVersion(user.id);

    return updated;
  }

  public async addUserRoleByKey(
    user: UserEntity,
    key: ROLE_KEYS,
  ): Promise<UserEntity> {
    const role: RoleEntity | null = await this.roleRepo.findOne({
      where: { key },
    });

    if (!role)
      throw new InternalServerErrorException(`Role "${key}" is not seeded.`);

    const alreadyHasRole: boolean =
      user.roles?.some((existingRole) => existingRole.key === role.key) ??
      false;

    if (alreadyHasRole) return user;

    return this.updateUser(user, {
      roles: [...(user.roles ?? []), role],
    });
  }

  public async deletePhone(
    phone: UserPhoneEntity,
    manager: EntityManager = this.userRepo.manager,
  ): Promise<void> {
    await manager.delete(UserPhoneEntity, {
      id: phone.id,
    });
  }
}
