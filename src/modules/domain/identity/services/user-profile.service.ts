import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { UserAddressEntity } from '../entities/address.entity';
import { UserPhoneEntity } from '../entities/phone.entity';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class UserProfileService {
  public constructor(private readonly userRepo: UserRepository) {}

  public async deleteAddress(
    address: UserAddressEntity,
    manager: EntityManager = this.userRepo.manager,
  ): Promise<void> {
    await manager.delete(UserAddressEntity, { id: address.id });
  }

  public async deletePhone(
    phone: UserPhoneEntity,
    manager: EntityManager = this.userRepo.manager,
  ): Promise<void> {
    await manager.delete(UserPhoneEntity, { id: phone.id });
  }

  public async clearAvatar(
    profileId: string,
    manager: EntityManager = this.userRepo.manager,
  ): Promise<void> {
    await manager.query(
      'UPDATE `user_profiles` SET `avatar_id` = NULL WHERE `id` = ?',
      [profileId],
    );
  }
}
