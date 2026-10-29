import { DataSource } from 'typeorm';

import { ArticleStatusSeeder } from '@/modules/domain/articles/seeders/status.seeder';
import { AccountStatusSeeder } from '@/modules/domain/identity/seeders/accountstatus.seeder';
import { GenderSeeder } from '@/modules/domain/identity/seeders/gender.seeder';
import { PermissionSeeder } from '@/modules/domain/identity/seeders/permission.seeder';
import { RoleSeeder } from '@/modules/domain/identity/seeders/role.seeder';
import { CountrySeeder } from '@/modules/domain/library/seeders/country.seeder';
import { RegionSeeder } from '@/modules/domain/library/seeders/region.seeder';
import { TimezoneSeeder } from '@/modules/domain/library/seeders/time-zone.seeder';
import { SeederService } from '@/modules/system/seeder/services/seeder.services';
import type { Seeder } from '@/modules/system/seeder/types/seeder.types';

export type SeederGroup = { name: string; seeders: Seeder[] };

// Keep dependency ordering explicit, shared by deployment and test preparation.
export const SEEDER_GROUPS: SeederGroup[] = [
  {
    name: 'Library',
    seeders: [new CountrySeeder(), new RegionSeeder(), new TimezoneSeeder()],
  },
  {
    name: 'Identity',
    seeders: [
      new GenderSeeder(),
      new PermissionSeeder(),
      new RoleSeeder(),
      new AccountStatusSeeder(),
    ],
  },
  { name: 'Articles', seeders: [new ArticleStatusSeeder()] },
];

export async function seedDatabase(
  dataSource: DataSource,
  groups: SeederGroup[] = SEEDER_GROUPS,
): Promise<void> {
  // One transaction covers every group: later failures undo earlier seed writes.
  await dataSource.transaction(async (manager) => {
    for (const group of groups) {
      await new SeederService(manager, group.seeders, group.name).run();
    }
  });
}

export async function runSeedCommand(dataSource: DataSource): Promise<void> {
  try {
    await dataSource.initialize();
    await seedDatabase(dataSource);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}
