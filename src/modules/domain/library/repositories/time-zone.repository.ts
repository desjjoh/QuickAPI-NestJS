import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { TimezoneEntity } from '../entities/time-zone.entity';

@Injectable()
export class TimezoneRepository extends Repository<TimezoneEntity> {
  public constructor(dataSource: DataSource) {
    super(TimezoneEntity, dataSource.createEntityManager());
  }

  public async findAll(): Promise<TimezoneEntity[]> {
    return this.find({ order: { key: 'ASC' } });
  }

  public async findById(id: string): Promise<TimezoneEntity | null> {
    return this.findOneBy({ id });
  }
}
