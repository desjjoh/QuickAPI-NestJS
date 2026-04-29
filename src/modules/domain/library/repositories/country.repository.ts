import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { CountryEntity } from '../entities/country.entity';

@Injectable()
export class CountryRepository extends Repository<CountryEntity> {
  public constructor(dataSource: DataSource) {
    super(CountryEntity, dataSource.createEntityManager());
  }

  public async findAll(): Promise<CountryEntity[]> {
    return this.find({ order: { label: 'ASC' } });
  }

  public async findById(id: string): Promise<CountryEntity | null> {
    return this.findOneBy({ id });
  }

  public async findByKey(key: string): Promise<CountryEntity | null> {
    return this.findOneBy({ key });
  }
}
