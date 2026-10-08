import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { ReferenceRepository } from '@/common/repositories/reference.repository';

import { CountryEntity } from '../entities/country.entity';

@Injectable()
export class CountryRepository extends ReferenceRepository<CountryEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(CountryEntity));
  }

  public findAll(manager: EntityManager): Promise<CountryEntity[]> {
    return this.getRepository(manager).find({
      relations: { regions: true },
      order: { key: 'ASC', regions: { key: 'ASC' } },
    });
  }
}
