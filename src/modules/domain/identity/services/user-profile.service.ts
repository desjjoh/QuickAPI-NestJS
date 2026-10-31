import { applicationManager } from '@/common/helpers/transaction.helper';
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
    manager: EntityManager = applicationManager(this.userRepo.manager),
  ): Promise<void> {
    await this.userRepo.deleteAddress(manager, address.id);
  }

  public async deletePhone(
    phone: UserPhoneEntity,
    manager: EntityManager = applicationManager(this.userRepo.manager),
  ): Promise<void> {
    await this.userRepo.deletePhone(manager, phone.id);
  }

  public async clearAvatar(
    profileId: string,
    manager: EntityManager = applicationManager(this.userRepo.manager),
  ): Promise<void> {
    await this.userRepo.clearAvatar(manager, profileId);
  }
}
