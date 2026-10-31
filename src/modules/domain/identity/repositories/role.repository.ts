import { In, EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ReferenceRepository } from '@/common/repositories/reference.repository';

import { RoleEntity } from '@/modules/domain/identity/entities/role.entity';

@Injectable()
export class RoleRepository extends ReferenceRepository<RoleEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(RoleEntity));
  }

  public findByIds(manager: EntityManager, ids: string[]) {
    return this.getRepository(manager).findBy({ id: In(ids) });
  }
}
