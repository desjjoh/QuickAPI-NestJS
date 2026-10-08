import {
  DeepPartial,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Base } from '@/common/models/base.model';
import { omitUndefinedDeep } from '@/common/helpers/typing.helper';

/** Persistence only. Services decide defaults, validation, and workflows. */
export abstract class DomainRepository<TEntity extends BaseEntity> {
  protected constructor(private readonly repository: Repository<TEntity>) {}

  public get manager(): EntityManager {
    return this.repository.manager;
  }

  protected getRepository(manager: EntityManager): Repository<TEntity> {
    return manager.getRepository(this.repository.target);
  }

  public findAll(manager: EntityManager): Promise<TEntity[]> {
    return this.getRepository(manager).find();
  }

  public findById(manager: EntityManager, id: string): Promise<TEntity | null> {
    return this.getRepository(manager).findOne({
      where: { id } as FindOptionsWhere<TEntity>,
    });
  }
}

/** Shared basic writes for mutable entities. Reads never throw HTTP errors. */
export abstract class MutableDomainRepository<
  TEntity extends BaseEntity,
> extends DomainRepository<TEntity> {
  public create(
    manager: EntityManager,
    payload: DeepPartial<Base<TEntity>>,
  ): Promise<TEntity> {
    const repository = this.getRepository(manager);
    return repository.save(
      repository.create(omitUndefinedDeep(payload) as DeepPartial<TEntity>),
    );
  }

  public update(
    manager: EntityManager,
    entity: TEntity,
    payload: DeepPartial<Base<TEntity>>,
  ): Promise<TEntity> {
    const repository = this.getRepository(manager);
    return repository.save(
      repository.merge(
        entity,
        omitUndefinedDeep(payload) as DeepPartial<TEntity>,
      ),
    );
  }

  public async remove(
    manager: EntityManager,
    entity: TEntity,
  ): Promise<TEntity> {
    await this.getRepository(manager).delete({
      id: entity.id,
    } as FindOptionsWhere<TEntity>);
    return entity;
  }
}
