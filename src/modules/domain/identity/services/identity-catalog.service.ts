import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { applicationManager } from '@/common/helpers/transaction.helper';
import { GenderRepository } from '../repositories/gender.repository';
import { RoleRepository } from '../repositories/role.repository';
import { AccountStatusRepository } from '../repositories/accountstatus.repository';

@Injectable()
export class IdentityCatalogService {
  public constructor(
    private readonly genderRepo: GenderRepository,
    private readonly roleRepo: RoleRepository,
    private readonly statusRepo: AccountStatusRepository,
  ) {}

  public getGenders(
    manager: EntityManager = applicationManager(this.genderRepo.manager),
  ) {
    return this.genderRepo.findAll(manager);
  }

  public getRoles(
    manager: EntityManager = applicationManager(this.roleRepo.manager),
  ) {
    return this.roleRepo.findAll(manager);
  }

  public getAccountStatuses(
    manager: EntityManager = applicationManager(this.statusRepo.manager),
  ) {
    return this.statusRepo.findAll(manager);
  }
}
