import { applicationManager } from '@/common/helpers/transaction.helper';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { AccountStatusKey } from '@/config/statuses.config';
import { AccountStatusEntity } from '@/modules/domain/identity/entities/accountstatus.entity';
import { RoleEntity } from '@/modules/domain/identity/entities/role.entity';
import { AccountStatusRepository } from '@/modules/domain/identity/repositories/accountstatus.repository';
import { RoleRepository } from '@/modules/domain/identity/repositories/role.repository';
import { ROLE_KEYS } from '@/modules/domain/identity/seeders/role.seeder';

@Injectable()
export class IdentityReferenceService {
  public constructor(
    private readonly roleRepo: RoleRepository,
    private readonly statusRepo: AccountStatusRepository,
  ) {}

  public async getAccountStatus(
    key: AccountStatusKey,
    manager: EntityManager = applicationManager(this.statusRepo.manager),
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
    manager: EntityManager = applicationManager(this.roleRepo.manager),
  ): Promise<RoleEntity> {
    const role = await this.roleRepo.findByKey(manager, key);

    if (!role)
      throw new InternalServerErrorException(`Role "${key}" is not seeded.`);

    return role;
  }

  public findStatusById(id: string, manager: EntityManager) {
    return this.statusRepo.findById(manager, id);
  }

  public findRolesByIds(ids: string[], manager: EntityManager) {
    return this.roleRepo.findByIds(manager, ids);
  }
}
