import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AccountStatusEntity } from '../entities/accountstatus.entity';

@Injectable()
export class AccountStatusRepository extends Repository<AccountStatusEntity> {
  public constructor(dataSource: DataSource) {
    super(AccountStatusEntity, dataSource.createEntityManager());
  }

  public async findAll(): Promise<AccountStatusEntity[]> {
    return this.find({ order: { key: 'ASC' } });
  }

  public async findById(id: string): Promise<AccountStatusEntity | null> {
    return this.findOneBy({ id });
  }

  public async findByKey(key: string): Promise<AccountStatusEntity | null> {
    return this.findOneBy({ key });
  }
}
