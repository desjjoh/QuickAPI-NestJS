import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ReferenceRepository } from '@/common/repositories/reference.repository';

import { TimezoneEntity } from '../entities/time-zone.entity';

@Injectable()
export class TimezoneRepository extends ReferenceRepository<TimezoneEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(TimezoneEntity));
  }
}
