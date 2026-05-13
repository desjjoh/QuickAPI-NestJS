import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, DeepPartial, EntityManager, Repository } from 'typeorm';

import { Base } from '@/common/models/base.model';

import { UserEntity } from '../entities/user.entity';
import { UserPaginationOptions } from '../models/user.model';
import { ImageService } from '../../library/services/image.service';
import { UserProfileEntity } from '../entities/profile.entity';
import { UserCredentialsEntity } from '../entities/credentials.entity';

@Injectable()
export class UserRepository extends Repository<UserEntity> {
  public constructor(
    private readonly imageSvc: ImageService,
    private readonly dataSource: DataSource,
  ) {
    super(UserEntity, dataSource.createEntityManager());
  }

  public async incrementTokenVersion(userId: string): Promise<void> {
    const user = await this.findByIdOrFail(userId);

    await this.save({
      ...user,
      credentials: {
        ...user.credentials,
        token_version: user.credentials.token_version + 1,
        refresh: null,
      },
    });
  }

  public async paginate(
    pageOptions: UserPaginationOptions,
  ): Promise<[UserEntity[], number]> {
    const { sort, search, order, take, skip } = pageOptions;
    return this.createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('roles.permissions', 'permissions')
      .leftJoinAndSelect('profile.avatar', 'avatar')
      .leftJoinAndSelect('profile.personal.gender', 'gender')
      .leftJoinAndSelect('profile.contact.address', 'address')
      .leftJoinAndSelect('address.country', 'country')
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
    return this.findOne({ where: { identity: { phone_e164 } } });
  }

  public async findByIdOrFail(id: string): Promise<UserEntity> {
    const user = await this.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');

    return user;
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

    const avatar = user.profile.avatar;
    const profileId = user.profile.id;
    const credentialsId = user.credentials.id;

    if (avatar) await this.imageSvc.remove(avatar);

    await this.manager.transaction(async (manager: EntityManager) => {
      await manager.remove(UserEntity, user);
      await manager.delete(UserProfileEntity, { id: profileId });
      await manager.delete(UserCredentialsEntity, { id: credentialsId });
    });
  }
}
