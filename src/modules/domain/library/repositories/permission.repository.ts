import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ReferenceRepository } from '@/common/repositories/reference.repository';

import { PermissionEntity } from '../entities/permission.entity';

@Injectable()
export class PermissionRepository extends ReferenceRepository<PermissionEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(PermissionEntity));
  }
}
