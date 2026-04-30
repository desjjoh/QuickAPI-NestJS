import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { RoleEntity } from '../entities/role.entity';

@Injectable()
export class RoleRepository extends Repository<RoleEntity> {
  public constructor(dataSource: DataSource) {
    super(RoleEntity, dataSource.createEntityManager());
  }

  public async findAll(): Promise<RoleEntity[]> {
    return this.find({ order: { key: 'ASC' } });
  }

  public async findById(id: string): Promise<RoleEntity | null> {
    return this.findOne({ where: { id } });
  }

  public async findByKey(key: string): Promise<RoleEntity | null> {
    return this.findOne({ where: { key } });
  }
}
