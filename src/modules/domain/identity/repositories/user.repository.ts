import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { DomainRepository } from '@/common/repositories/domain.repository';

import { UserEntity } from '../entities/user.entity';
import { UserPaginationOptions } from '../models/user.model';

@Injectable()
export class UserRepository extends DomainRepository<UserEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(UserEntity));
  }

  public paginate(
    manager: EntityManager,
    pageOptions: UserPaginationOptions,
  ): Promise<[UserEntity[], number]> {
    const { sort, search, order, take, skip } = pageOptions;

    return this.getRepository(manager)
      .createQueryBuilder('user')
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
      .addSelect(
        "CONCAT(profile.name.first, ' ', profile.name.last)",
        'fullname',
      )
      .orderBy({ [sort]: order })
      .take(take)
      .skip(skip)
      .getManyAndCount();
  }

  public findAll(manager: EntityManager): Promise<UserEntity[]> {
    return this.getRepository(manager).find({
      order: { createdAt: 'ASC' },
    });
  }

  public findByEmail(
    manager: EntityManager,
    email: string,
  ): Promise<UserEntity | null> {
    return this.getRepository(manager).findOne({
      where: { identity: { email } },
    });
  }

  public findByPhone(
    manager: EntityManager,
    phoneE164: string,
  ): Promise<UserEntity | null> {
    return this.getRepository(manager).findOne({
      where: {
        profile: { contact: { phone: { phone_e164: phoneE164 } } },
      },
    });
  }
}
