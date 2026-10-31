import { UserProfileEntity } from '../entities/profile.entity';
import { RoleEntity } from '../entities/role.entity';
import { UserSessionEntity } from '../entities/session.entity';
import { AccountTokenEntity } from '../entities/account-token.entity';
import { RegistrationTokenEntity } from '../entities/registration-token.entity';
import { UserMfaSettingsEntity } from '../entities/mfa.entity';
import { UserPhoneEntity } from '../entities/phone.entity';
import { UserAddressEntity } from '../entities/address.entity';
import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, EntityManager, Not } from 'typeorm';
import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';

import { MutableDomainRepository } from '@/common/repositories/domain.repository';

import { UserEntity } from '../entities/user.entity';
import { UserPaginationOptions } from '../models/user.model';

@Injectable()
export class UserRepository extends MutableDomainRepository<UserEntity> {
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
      .where('status.key != :deletedStatus', {
        deletedStatus: ACCOUNT_STATUS_KEYS.DELETED,
      })
      .andWhere(
        new Brackets((query) =>
          query.where(
            "user.email like :query OR CONCAT(profile.name.first, ' ', profile.name.last) like :query",
            { query: `%${search}%` },
          ),
        ),
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
      where: { status: { key: Not(ACCOUNT_STATUS_KEYS.DELETED) } },
      order: { createdAt: 'ASC' },
    });
  }

  /** Includes tombstones only when explicitly requested for historical snapshots. */
  public findIncludingDeleted(
    manager: EntityManager,
    id: string,
  ): Promise<UserEntity | null> {
    return this.getRepository(manager).findOne({ where: { id } });
  }

  public findForUpdate(
    manager: EntityManager,
    id: string,
  ): Promise<UserEntity | null> {
    return this.getRepository(manager).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  public findByEmail(
    manager: EntityManager,
    email: string,
  ): Promise<UserEntity | null> {
    return this.getRepository(manager).findOne({
      // Deleted accounts have unique internal emails; their original email is reusable.
      where: { identity: { email } },
    });
  }

  public findByPhone(
    manager: EntityManager,
    phoneE164: string,
  ): Promise<UserEntity | null> {
    return this.getRepository(manager).findOne({
      where: {
        status: { key: Not(ACCOUNT_STATUS_KEYS.DELETED) },
        profile: { contact: { phone: { phone_e164: phoneE164 } } },
      },
    });
  }

  public findById(
    manager: EntityManager,
    id: string,
  ): Promise<UserEntity | null> {
    return this.getRepository(manager).findOne({
      where: { id, status: { key: Not(ACCOUNT_STATUS_KEYS.DELETED) } },
    });
  }

  public setStatus(manager: EntityManager, id: string, statusId: string) {
    return manager
      .createQueryBuilder()
      .relation(UserEntity, 'status')
      .of(id)
      .set(statusId);
  }

  public replaceRoles(
    manager: EntityManager,
    id: string,
    added: RoleEntity[],
    removed: RoleEntity[],
  ) {
    return manager
      .createQueryBuilder()
      .relation(UserEntity, 'roles')
      .of(id)
      .addAndRemove(added, removed);
  }

  public removeRoles(manager: EntityManager, id: string, roles: RoleEntity[]) {
    return manager
      .createQueryBuilder()
      .relation(UserEntity, 'roles')
      .of(id)
      .remove(roles);
  }

  public deleteSessions(manager: EntityManager, id: string) {
    return manager.delete(UserSessionEntity, { user: { id } });
  }

  public deleteAccountTokens(manager: EntityManager, id: string) {
    return manager.delete(AccountTokenEntity, { user: { id } });
  }

  public deleteRegistrationTokens(manager: EntityManager, email: string) {
    return manager.delete(RegistrationTokenEntity, { email });
  }

  public deleteMfaSettings(manager: EntityManager, id: string) {
    return manager.delete(UserMfaSettingsEntity, { user: { id } });
  }

  public deletePhonesForProfile(manager: EntityManager, id: string) {
    return manager.delete(UserPhoneEntity, { profile: { id } });
  }

  public deleteAddressesForProfile(manager: EntityManager, id: string) {
    return manager.delete(UserAddressEntity, { profile: { id } });
  }

  public deletePhone(manager: EntityManager, id: string) {
    return manager.delete(UserPhoneEntity, { id });
  }

  public deleteAddress(manager: EntityManager, id: string) {
    return manager.delete(UserAddressEntity, { id });
  }

  public clearAvatar(manager: EntityManager, profileId: string) {
    return manager.query(
      'UPDATE `user_profiles` SET `avatar_id` = NULL WHERE `id` = ?',
      [profileId],
    );
  }

  public detachAvatar(manager: EntityManager, profileId: string) {
    return manager.update(
      UserProfileEntity,
      { id: profileId },
      { media: { avatar: null } },
    );
  }
}
