import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { DeepPartial } from 'typeorm';

import {
  getClearRefreshCookieOptions,
  getRefreshCookieName,
} from '@/config/cookie.config';

import { UserEntity } from '../entities/user.entity';
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

    const isMatch = await bcrypt.compare(password, user.identity.password);

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
      throw new UnauthorizedException('User does not have required permission');
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

  public async deleteAddress(address: UserAddressEntity): Promise<void> {
    await this.userRepo.manager.delete(UserAddressEntity, {
      id: address.id,
    });
  }

  public async updateUser(user: UserEntity, dto: DeepPartial<UserEntity>) {
    await this.userRepo.update(user.id, dto);

    return this.userRepo.findByIdOrFail(user.id);
  }

  public async deleteUser(user: UserEntity, res: Response): Promise<void> {
    await this.userRepo.removeUser(user.id);

    res.clearCookie(getRefreshCookieName(), getClearRefreshCookieOptions());
  }

  private async getDefaultAccountStatus(): Promise<AccountStatusEntity> {
    const status: AccountStatusEntity | null = await this.statusRepo.findOne({
      where: { key: ACCOUNT_STATUS_KEYS.PENDING_VERIFICATION },
    });

    if (!status)
      throw new InternalServerErrorException(
        'Default account status is not seeded.',
      );

    return status;
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
    const user: UserEntity = await this.userRepo.createUser({
      ...input,
      credentials: {
        refresh: null,
        token_version: 0,
      },
      status: { id: status.id },
    });

    return this.userRepo.findByIdOrFail(user.id);
  }

  public async updateUserStatusByKey(
    user: UserEntity,
    key: AccountStatusKey,
  ): Promise<UserEntity> {
    const status = await this.statusRepo.findOne({
      where: { key },
    });

    if (!status)
      throw new InternalServerErrorException(
        `Account status "${key}" is not seeded.`,
      );

    const updated = await this.updateUser(user, {
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

    const updatedUser: UserEntity = this.userRepo.merge(user, {
      roles: [...(user.roles ?? []), role],
    });

    await this.userRepo.save(updatedUser);

    return this.userRepo.findByIdOrFail(updatedUser.id);
  }
}
