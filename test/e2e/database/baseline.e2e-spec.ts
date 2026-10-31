import { SEEDER_GROUPS } from '@/database/seeders';
import { SeederService } from '@/modules/system/seeder/services/seeder.services';
import { DataSource } from 'typeorm';
import { PermissionEntity } from '@/modules/domain/identity/entities/permission.entity';
import { RoleEntity } from '@/modules/domain/identity/entities/role.entity';
import { PERMISSIONS_SEED } from '@/modules/domain/identity/seeders/permission.seeder';
import { ROLES_SEED } from '@/modules/domain/identity/seeders/role.seeder';
import {
  closeTestDataSource,
  initializeTestDataSource,
  resetMutableTables,
  withRollbackTransaction,
} from '../../helpers/database/test-database';

describe('fresh database baseline', () => {
  let source: DataSource;

  beforeAll(async () => {
    source = await initializeTestDataSource();
    await resetMutableTables(source);
  });

  afterAll(async () => {
    await closeTestDataSource(source);
  });

  it('creates exactly the current entity tables and matches their schema', async () => {
    const tables: Array<{ name: string }> = await source.query(
      'SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()',
    );
    const expected = [
      ...source.entityMetadatas.map((metadata) => metadata.tableName),
      'typeorm_migrations',
    ];

    expect(tables.map((table) => table.name).sort()).toEqual(expected.sort());

    const schema = await source.driver.createSchemaBuilder().log();

    expect(schema.upQueries.map((query) => query.query)).toEqual([]);
  });

  it('seeds only the current authorization catalog', async () => {
    // Other suites add custom roles. Test the seed catalog from a clean,
    // transaction-local authorization state rather than relying on suite order.
    await withRollbackTransaction(source, async ({ manager }) => {
      for (const table of ['role_permissions', 'roles', 'permissions']) {
        await manager.query(`DELETE FROM \`${table}\``);
      }
      for (const group of SEEDER_GROUPS) {
        await new SeederService(manager, group.seeders, group.name).run();
      }
      const roles = await manager.getRepository(RoleEntity).find();
      const permissions = await manager.getRepository(PermissionEntity).find();

      expect(roles.map((role) => role.key).sort()).toEqual(
        ROLES_SEED.map((role) => role.key).sort(),
      );
      expect(permissions.map((permission) => permission.key).sort()).toEqual(
        PERMISSIONS_SEED.map((permission) => permission.key).sort(),
      );

      for (const seed of ROLES_SEED) {
        const role = roles.find((candidate) => candidate.key === seed.key)!;

        expect(
          role.permissions?.map((permission) => permission.key).sort(),
        ).toEqual([...seed.permissions].sort());
      }
    });
  });
});
