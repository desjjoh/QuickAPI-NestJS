import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ReferenceRepository } from '@/common/repositories/reference.repository';

import { RoleEntity } from '../entities/role.entity';

@Injectable()
export class RoleRepository extends ReferenceRepository<RoleEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(RoleEntity));
  }
}
