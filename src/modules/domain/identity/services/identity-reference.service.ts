import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { AccountStatusKey } from '@/config/statuses.config';
import { AccountStatusEntity } from '@/modules/domain/library/entities/accountstatus.entity';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';
import { AccountStatusRepository } from '@/modules/domain/library/repositories/accountstatus.repository';
import { RoleRepository } from '@/modules/domain/library/repositories/role.repository';
import { ROLE_KEYS } from '@/modules/domain/library/seeders/role.seeder';

@Injectable()
export class IdentityReferenceService {
  public constructor(
    private readonly roleRepo: RoleRepository,
    private readonly statusRepo: AccountStatusRepository,
  ) {}

  public async getAccountStatus(
    key: AccountStatusKey,
    manager: EntityManager = this.statusRepo.manager,
  ): Promise<AccountStatusEntity> {
    const status = await this.statusRepo.findByKey(manager, key);

    if (!status)
      throw new InternalServerErrorException(
        `Account status "${key}" is not seeded.`,
      );

    return status;
  }

  public async getRole(
    key: ROLE_KEYS,
    manager: EntityManager = this.roleRepo.manager,
  ): Promise<RoleEntity> {
    const role = await this.roleRepo.findByKey(manager, key);

    if (!role)
      throw new InternalServerErrorException(`Role "${key}" is not seeded.`);

    return role;
  }
}
