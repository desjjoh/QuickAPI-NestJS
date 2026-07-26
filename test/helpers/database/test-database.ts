import { DataSource, QueryRunner } from 'typeorm';

import applicationDataSource from '@/database/typeorm.datasource';
import { AccountStatusSeeder } from '@/modules/domain/library/seeders/accountstatus.seeder';
import { CountrySeeder } from '@/modules/domain/library/seeders/country.seeder';
import { GenderSeeder } from '@/modules/domain/library/seeders/gender.seeder';
import { PermissionSeeder } from '@/modules/domain/library/seeders/permission.seeder';
import { RegionSeeder } from '@/modules/domain/library/seeders/region.seeder';
import { RoleSeeder } from '@/modules/domain/library/seeders/role.seeder';
import { TimezoneSeeder } from '@/modules/domain/library/seeders/time-zone.seeder';
import type { Seeder } from '@/modules/system/seeder/types/seeder.types';

import { assertSafeTestDatabase } from './safety';

const REFERENCE_SEEDERS: Seeder[] = [
  new GenderSeeder(),
  new AccountStatusSeeder(),
  new CountrySeeder(),
  new RegionSeeder(),
  new TimezoneSeeder(),
  new PermissionSeeder(),
  new RoleSeeder(),
].sort((left, right) => left.order - right.order);

// Children precede parents. Reference tables and TypeORM's migration ledger
// are intentionally absent: reset preserves the known baseline data.
export const MUTABLE_TABLE_DELETE_ORDER = [
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

export function createTestDataSource(): DataSource {
  assertSafeTestDatabase();
  return new DataSource({
    ...applicationDataSource.options,
    synchronize: false,
  });
}

export async function initializeTestDataSource(): Promise<DataSource> {
  const dataSource = createTestDataSource();
  await dataSource.initialize();
  initializedConnections.add(dataSource);
  return dataSource;
}

export async function migrateAndSeedEmptyTestSchema(): Promise<void> {
  // No schema operation is allowed above this assertion.
  assertSafeTestDatabase();
  const dataSource = await initializeTestDataSource();

  try {
    await dataSource.dropDatabase();
    await dataSource.runMigrations({ transaction: 'all' });
    for (const seeder of REFERENCE_SEEDERS) await seeder.run(dataSource);
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
