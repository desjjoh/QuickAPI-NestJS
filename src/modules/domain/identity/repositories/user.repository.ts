import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  In,
  Repository,
} from 'typeorm';

import { Base } from '@/common/models/base.model';

import { UserEntity } from '../entities/user.entity';
import { UserPaginationOptions } from '../models/user.model';
import { UserProfileEntity } from '../entities/profile.entity';
import { ImageService } from '../../media/services/image.service';
import { UserSessionEntity } from '../entities/session.entity';
import { AccountStatusEntity } from '../../library/entities/accountstatus.entity';
import { RoleEntity } from '../../library/entities/role.entity';

@Injectable()
export class UserRepository extends Repository<UserEntity> {
  public constructor(
    private readonly imageSvc: ImageService,
    private readonly dataSource: DataSource,
  ) {
    super(UserEntity, dataSource.createEntityManager());
  }

  public async incrementTokenVersion(userId: string): Promise<void> {
    await this.manager
      .createQueryBuilder()
      .update(UserSessionEntity)
      .set({ token_version: () => '`token_version` + 1' })
      .where('userId = :userId AND active = true', { userId })
      .execute();
  }

  public async revokeAllSessions(userId: string): Promise<void> {
    await this.manager
      .createQueryBuilder()
      .update(UserSessionEntity)
      .set({ active: false, refresh: null })
      .where('userId = :userId AND active = true', { userId })
      .execute();
  }

  public async paginate(
    pageOptions: UserPaginationOptions,
  ): Promise<[UserEntity[], number]> {
    const { sort, search, order, take, skip } = pageOptions;
    return this.createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('user.status', 'status')
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('roles.permissions', 'permissions')
      .leftJoinAndSelect('profile.media.avatar', 'avatar')
      .leftJoinAndSelect('profile.personal.gender', 'gender')
      .leftJoinAndSelect('profile.region.country', 'profileCountry')
      .leftJoinAndSelect('profile.region.timezone', 'timezone')
      .leftJoinAndSelect('profile.contact.phone', 'phone')
      .leftJoinAndSelect('phone.country', 'phoneCountry')
      .leftJoinAndSelect('profile.contact.address', 'address')
      .leftJoinAndSelect('address.region', 'region')
      .leftJoinAndSelect('address.country', 'addressCountry')
      .where(
        "user.email like :query OR CONCAT(profile.name.first, ' ', profile.name.last) like :query",
        { query: `%${search}%` },
      )
      .orderBy({ [sort]: order })
      .take(take)
      .skip(skip)
      .getManyAndCount();
  }

  public async findAll(): Promise<UserEntity[]> {
    return this.find({ order: { createdAt: 'ASC' } });
  }

  public async findByEmail(email: string): Promise<UserEntity | null> {
    return this.findOne({ where: { identity: { email } } });
  }

  public async findByPhone(phone_e164: string): Promise<UserEntity | null> {
    return this.findOne({
      where: { profile: { contact: { phone: { phone_e164 } } } },
    });
  }

  public async findByIdOrFail(id: string): Promise<UserEntity> {
    const user = await this.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');

    return user;
  }

  public async clearProfileAvatar(profileId: string): Promise<void> {
    await this.manager.query(
      'UPDATE `user_profiles` SET `avatar_id` = NULL WHERE `id` = ?',
      [profileId],
    );
  }

  public async createUser(
    payload: DeepPartial<Base<UserEntity>>,
  ): Promise<UserEntity> {
    const user = this.create(payload);
    const created = await this.save(user);

    return this.findByIdOrFail(created.id);
  }

  public async removeUser(id: string): Promise<void> {
    const user = await this.findByIdOrFail(id);

    const avatar = user.profile.media.avatar;
    const profileId = user.profile.id;

    await this.manager.transaction(async (manager: EntityManager) => {
      await manager.remove(UserEntity, user);
      await manager.delete(UserProfileEntity, { id: profileId });
    });

    if (avatar) await this.imageSvc.remove(avatar);
  }

  public async updateUserAdministration(
    id: string,
    input: { status_id?: string; role_ids?: string[] },
  ): Promise<UserEntity> {
    const user = await this.findByIdOrFail(id);

    await this.manager.transaction(async (manager: EntityManager) => {
      const status = input.status_id
        ? await manager.findOneBy(AccountStatusEntity, { id: input.status_id })
        : null;

      if (input.status_id && !status)
        throw new BadRequestException('Account status not found.');

      const roles = input.role_ids
        ? await manager.findBy(RoleEntity, { id: In(input.role_ids) })
        : null;

      if (roles && roles.length !== new Set(input.role_ids).size)
        throw new BadRequestException('One or more roles were not found.');

      if (status)
        await manager
          .createQueryBuilder()
          .relation(UserEntity, 'status')
          .of(user.id)
          .set(status.id);

      if (roles)
        await manager
          .createQueryBuilder()
          .relation(UserEntity, 'roles')
          .of(user.id)
          .addAndRemove(roles, user.roles ?? []);
    });

    return this.findByIdOrFail(id);
  }
}
