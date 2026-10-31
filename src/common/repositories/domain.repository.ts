import {
  DeepPartial,
  EntityManager,
  FindOptionsWhere,
  Repository,
  FindOneOptions,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import { BaseEntity } from '@/common/entities/base.entity';
import { Base } from '@/common/models/base.model';
import { omitUndefinedDeep } from '@/common/helpers/typing.helper';

/** Persistence only. Services decide defaults, validation, and workflows. */
export abstract class DomainRepository<TEntity extends BaseEntity> {
  protected constructor(private readonly repository: Repository<TEntity>) {}

  protected get target() {
    return this.repository.target;
  }

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

/** Shared basic writes for mutable entities. Persistence methods never throw HTTP errors. */
export abstract class MutableDomainRepository<
  TEntity extends BaseEntity,
> extends DomainRepository<TEntity> {
  public instantiate(
    manager: EntityManager,
    payload: DeepPartial<TEntity>,
  ): TEntity {
    return manager.create(this.target, payload);
  }

  public merge(
    manager: EntityManager,
    entity: TEntity,
    payload: DeepPartial<TEntity>,
  ): TEntity {
    return manager.merge(this.target, entity, payload);
  }

  public save(
    manager: EntityManager,
    entity: DeepPartial<TEntity>,
  ): Promise<TEntity> {
    return manager.save(this.target, entity);
  }

  public insert(
    manager: EntityManager,
    entity: QueryDeepPartialEntity<TEntity>,
  ) {
    return manager.insert(this.target, entity);
  }

  public patch(
    manager: EntityManager,
    criteria: string | FindOptionsWhere<TEntity>,
    payload: QueryDeepPartialEntity<TEntity>,
  ) {
    return manager.update(this.target, criteria, payload);
  }

  public deleteWhere(
    manager: EntityManager,
    criteria: FindOptionsWhere<TEntity>,
  ) {
    return manager.delete(this.target, criteria);
  }

  public increment(
    manager: EntityManager,
    criteria: FindOptionsWhere<TEntity>,
    property: string,
    amount: number,
  ) {
    return manager.increment(this.target, criteria, property, amount);
  }

  public findOne(manager: EntityManager, options: FindOneOptions<TEntity>) {
    return manager.findOne(this.target, options);
  }

  public findOneOrFail(
    manager: EntityManager,
    options: FindOneOptions<TEntity>,
  ) {
    return manager.findOneOrFail(this.target, options);
  }

  public findOneByOrFail(
    manager: EntityManager,
    where: FindOptionsWhere<TEntity>,
  ) {
    return manager.findOneByOrFail(this.target, where);
  }

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
    const detachedEntity = repository.create(entity as DeepPartial<TEntity>);

    return repository.save(
      repository.merge(
        detachedEntity,
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
