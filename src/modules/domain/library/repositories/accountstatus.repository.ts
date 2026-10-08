import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ReferenceRepository } from '@/common/repositories/reference.repository';

import { AccountStatusEntity } from '../entities/accountstatus.entity';

@Injectable()
export class AccountStatusRepository extends ReferenceRepository<AccountStatusEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(AccountStatusEntity));
  }
}
