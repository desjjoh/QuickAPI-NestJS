import type { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';

/** Exercise real persistence adapters against a controlled manager without opening a database. */
export function repositoryFixture<
  T extends { manager: unknown },
  R extends object,
>(
  mock: T,
  RepositoryType: new (source: DataSource) => R,
  target: EntityTarget<ObjectLiteral>,
): T & R {
  const { manager, ...overrides } = mock;
  const source = {
    getRepository: () => ({ target, manager }),
  } as unknown as DataSource;
  return Object.assign(new RepositoryType(source), overrides) as T & R;
}
