import { seedDatabase } from '@/database/seeders';
import { DataSource, QueryRunner } from 'typeorm';

import applicationDataSource from '@/database/typeorm.datasource';

import { assertSafeTestDatabase } from './safety';

// Children precede parents. Reference tables and TypeORM's migration ledger
// are intentionally absent: reset preserves the known baseline data.
export const MUTABLE_TABLE_DELETE_ORDER = [
  'storage_deletion_intents',
  'storage_objects',
  'email_intents',
  'request_idempotency',
  'activity_audits',
  'user_mfa_settings',
  'user_sessions',
  'account_tokens',
  'registration_tokens',
  'user_roles',
  'user_phones',
  'profile_alternate_phones',
  'profile_addresses',
  'users',
  'user_credentials',
  'user_profiles',
  'images',
] as const;

const initializedConnections = new Set<DataSource>();

export function createTestDataSource({
  includeMigrations = false,
}: { includeMigrations?: boolean } = {}): DataSource {
  assertSafeTestDatabase();
  return new DataSource({
    ...applicationDataSource.options,
    synchronize: false,
    // Jest already runs migrations in global setup. Omitting the migration
    // glob from worker connections also prevents TypeORM from trying to
    // require transformed ESM migration files on Windows.
    migrations: includeMigrations
      ? applicationDataSource.options.migrations
      : [],
  });
}

export async function initializeTestDataSource(
  options: { includeMigrations?: boolean } = {},
): Promise<DataSource> {
  const dataSource = createTestDataSource(options);
  await dataSource.initialize();
  initializedConnections.add(dataSource);
  return dataSource;
}

export async function migrateAndSeedEmptyTestSchema(): Promise<void> {
  // No schema operation is allowed above this assertion.
  assertSafeTestDatabase();
  const dataSource = await initializeTestDataSource({
    includeMigrations: true,
  });

  try {
    await dataSource.dropDatabase();
    await dataSource.runMigrations({ transaction: 'all' });
    await seedDatabase(dataSource);
  } finally {
    await closeTestDataSource(dataSource);
  }
}

export async function resetMutableTables(
  dataSource: DataSource,
): Promise<void> {
  assertSafeTestDatabase();
  await dataSource.transaction(async (manager) => {
    for (const table of MUTABLE_TABLE_DELETE_ORDER) {
      if (await manager.queryRunner?.hasTable(table)) {
        await manager.query(`DELETE FROM \`${table}\``);
      }
    }
  });
}

/** Prefer this helper when every operation in a test accepts the same runner. */
export async function withRollbackTransaction<T>(
  dataSource: DataSource,
  operation: (queryRunner: QueryRunner) => Promise<T>,
): Promise<T> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    return await operation(runner);
  } finally {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    await runner.release();
  }
}

export async function closeTestDataSource(
  dataSource: DataSource,
): Promise<void> {
  initializedConnections.delete(dataSource);
  if (dataSource.isInitialized) await dataSource.destroy();
}

export async function closeAllTestDataSources(): Promise<void> {
  await Promise.all([...initializedConnections].map(closeTestDataSource));
}
