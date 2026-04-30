import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { PermissionEntity } from '../entities/permission.entity';

@Injectable()
export class PermissionRepository extends Repository<PermissionEntity> {
  public constructor(dataSource: DataSource) {
    super(PermissionEntity, dataSource.createEntityManager());
  }

  public async findAll(): Promise<PermissionEntity[]> {
    return this.find({ order: { key: 'ASC' } });
  }

  public async findById(id: string): Promise<PermissionEntity | null> {
    return this.findOne({ where: { id } });
  }

  public async findByKey(key: string): Promise<PermissionEntity | null> {
    return this.findOne({ where: { key } });
  }
}
