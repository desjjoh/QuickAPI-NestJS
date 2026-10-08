import { KeyedDomainRepository, KeyedEntity } from './keyed.repository';

export abstract class ReferenceRepository<
  TEntity extends KeyedEntity,
> extends KeyedDomainRepository<TEntity> {}
