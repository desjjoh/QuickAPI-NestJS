import { EntityManager } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';
import { MutableDomainRepository } from './domain.repository';

export type KeyedEntity = BaseEntity & { key: string };

export abstract class KeyedDomainRepository<
  TEntity extends KeyedEntity,
> extends MutableDomainRepository<TEntity> {
  public findAll(manager: EntityManager): Promise<TEntity[]> {
    return this.getRepository(manager).find({
      order: { key: 'ASC' },
    } as never);
  }

  public findByKey(
    manager: EntityManager,
    key: string,
  ): Promise<TEntity | null> {
    return this.getRepository(manager).findOne({
      where: { key },
    } as never);
  }
}
