import { jest } from '@jest/globals';
import type { Seeder } from '@/modules/system/seeder/types/seeder.types';
import { DataSource } from 'typeorm';
import { seedDatabase } from '@/database/seeders';
import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { RoleEntity } from '@/modules/domain/identity/entities/role.entity';
import { PermissionEntity } from '@/modules/domain/identity/entities/permission.entity';
import { ArticleStatusEntity } from '@/modules/domain/articles/entities/articleStatus.entity';
import {
  initializeTestDataSource,
  closeTestDataSource,
} from '../../helpers/database/test-database';

describe('explicit database seeding', () => {
  let source: DataSource;

  beforeAll(async () => {
    source = await initializeTestDataSource();
  });
  afterAll(async () => {
    await closeTestDataSource(source);
  });

  it('repeats the baseline without duplicating records or role permissions', async () => {
    const snapshot = async () => ({
      countries: await source.getRepository(CountryEntity).count(),
      roles: await source
        .getRepository(RoleEntity)
        .find({ order: { key: 'ASC' } }),
      permissions: await source.getRepository(PermissionEntity).count(),
      statuses: await source.getRepository(ArticleStatusEntity).count(),
    });
    const before = await snapshot();
    expect(before.countries).toBeGreaterThan(0);
    expect(before.roles.length).toBeGreaterThan(0);

    await seedDatabase(source);
    await seedDatabase(source);

    expect(await snapshot()).toEqual(before);
  });

  it('rolls back earlier groups when a later group fails', async () => {
    const later = jest.fn<Seeder['run']>();
    const before = await source.getRepository(CountryEntity).count();
    await expect(
      seedDatabase(source, [
        {
          name: 'Write',
          seeders: [
            {
              name: 'write',
              order: 1,
              run: async (manager) => {
                await manager
                  .getRepository(CountryEntity)
                  .update({ key: 'canada' }, { label: 'Must roll back' });
                return { created: 0, skipped: 1 };
              },
            },
          ],
        },
        {
          name: 'Fail',
          seeders: [
            {
              name: 'fail',
              order: 1,
              run: async () => {
                throw new Error('injected seed failure');
              },
            },
          ],
        },
        {
          name: 'Never',
          seeders: [{ name: 'never', order: 1, run: later }],
        },
      ]),
    ).rejects.toThrow('injected seed failure');

    expect(
      (
        await source
          .getRepository(CountryEntity)
          .findOneByOrFail({ key: 'canada' })
      ).label,
    ).toBe('Canada');
    expect(await source.getRepository(CountryEntity).count()).toBe(before);
    expect(later).not.toHaveBeenCalled();
  });
});
