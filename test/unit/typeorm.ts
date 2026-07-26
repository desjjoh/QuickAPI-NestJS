import type {
  DataSource,
  EntityManager,
  EntityTarget,
  ObjectLiteral,
  Repository,
} from 'typeorm';

export type MockRepository<TEntity extends ObjectLiteral> = jest.Mocked<
  Pick<
    Repository<TEntity>,
    | 'create'
    | 'delete'
    | 'exist'
    | 'find'
    | 'findAndCount'
    | 'findOne'
    | 'findOneBy'
    | 'insert'
    | 'remove'
    | 'save'
    | 'softDelete'
    | 'update'
  >
>;

export const mockRepository = <
  TEntity extends ObjectLiteral,
>(): MockRepository<TEntity> => ({
  create: jest.fn() as unknown as MockRepository<TEntity>['create'],
  delete: jest.fn(),
  exist: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  insert: jest.fn(),
  remove: jest.fn(),
  save: jest.fn(),
  softDelete: jest.fn(),
  update: jest.fn(),
});

export type MockEntityManager = jest.Mocked<
  Pick<
    EntityManager,
    | 'delete'
    | 'find'
    | 'findOne'
    | 'getRepository'
    | 'remove'
    | 'save'
    | 'update'
  >
>;

export const mockEntityManager = (): MockEntityManager => ({
  delete: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  getRepository: jest.fn(),
  remove: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

export type MockDataSource = jest.Mocked<Pick<DataSource, 'transaction'>>;

export const mockDataSource = (
  manager: MockEntityManager = mockEntityManager(),
): MockDataSource => {
  const transaction = jest.fn(async (...args: unknown[]) => {
    const operation = args.at(-1) as (entityManager: EntityManager) => unknown;
    return operation(manager as unknown as EntityManager);
  }) as unknown as MockDataSource['transaction'];

  return { transaction };
};

export const useRepository = <TEntity extends ObjectLiteral>(
  manager: MockEntityManager,
  target: EntityTarget<TEntity>,
  repository: MockRepository<TEntity>,
): void => {
  manager.getRepository.mockImplementation((requested) => {
    if (requested !== target)
      throw new Error('Unexpected repository requested');
    return repository as unknown as Repository<ObjectLiteral>;
  });
};
