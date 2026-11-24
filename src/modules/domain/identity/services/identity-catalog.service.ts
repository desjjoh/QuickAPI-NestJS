import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { applicationManager } from '@/common/helpers/transaction.helper';
import { GenderRepository } from '../repositories/gender.repository';

@Injectable()
export class IdentityCatalogService {
  public constructor(private readonly genderRepo: GenderRepository) {}

  public getGenders(
    manager: EntityManager = applicationManager(this.genderRepo.manager),
  ) {
    return this.genderRepo.findAll(manager);
  }
}
