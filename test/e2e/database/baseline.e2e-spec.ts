import { DataSource } from 'typeorm';
import { PermissionEntity } from '@/modules/domain/identity/entities/permission.entity';
import { RoleEntity } from '@/modules/domain/identity/entities/role.entity';
import { PERMISSIONS_SEED } from '@/modules/domain/identity/seeders/permission.seeder';
import { ROLES_SEED } from '@/modules/domain/identity/seeders/role.seeder';
import {
  closeTestDataSource,
  initializeTestDataSource,
} from '../../helpers/database/test-database';

describe('fresh database baseline', () => {
  let source: DataSource;

  beforeAll(async () => {
    source = await initializeTestDataSource();
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
    const roles = await source.getRepository(RoleEntity).find();
    const permissions = await source.getRepository(PermissionEntity).find();

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
