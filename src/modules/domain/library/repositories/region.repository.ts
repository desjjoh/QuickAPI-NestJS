import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { DomainRepository } from '@/common/repositories/domain.repository';

import { RegionEntity } from '../entities/region.entity';

@Injectable()
export class RegionRepository extends DomainRepository<RegionEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(RegionEntity));
  }

  public findAll(manager: EntityManager): Promise<RegionEntity[]> {
    return this.getRepository(manager).find({
      order: { country: { key: 'ASC' }, key: 'ASC' },
    });
  }

  public async findByIdAndCountry(
    manager: EntityManager,
    id: string,
    countryId: string,
  ): Promise<RegionEntity | null> {
    return this.getRepository(manager).findOne({
      where: {
        id,
        country: { id: countryId },
      },
    });
  }
}
