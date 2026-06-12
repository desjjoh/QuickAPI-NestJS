import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { RegionEntity } from '../entities/region.entity';

@Injectable()
export class RegionRepository extends Repository<RegionEntity> {
  public constructor(dataSource: DataSource) {
    super(RegionEntity, dataSource.createEntityManager());
  }

  public async findAll(): Promise<RegionEntity[]> {
    return this.find({ order: { country: { key: 'ASC' }, key: 'ASC' } });
  }

  public async findById(id: string): Promise<RegionEntity | null> {
    return this.findOne({ where: { id } });
  }

  public async findByIdAndCountry(
    id: string,
    countryId: string,
  ): Promise<RegionEntity | null> {
    return this.findOne({
      where: {
        id,
        country: { id: countryId },
      },
    });
  }
}
