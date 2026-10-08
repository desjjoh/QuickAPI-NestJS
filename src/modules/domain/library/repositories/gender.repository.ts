import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ReferenceRepository } from '@/common/repositories/reference.repository';

import { GenderEntity } from '../entities/gender.entity';

@Injectable()
export class GenderRepository extends ReferenceRepository<GenderEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(GenderEntity));
  }
}
