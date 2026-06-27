import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SeedingModule } from '@/modules/system/seeder/seeder.module';

import { CountryEntity } from './entities/country.entity';
import { GenderEntity } from './entities/gender.entity';
import { PermissionEntity } from './entities/permission.entity';
import { RoleEntity } from './entities/role.entity';

import { PermissionRepository } from './repositories/permission.repository';
import { RoleRepository } from './repositories/role.repository';
import { GenderRepository } from './repositories/gender.repository';
import { CountryRepository } from './repositories/country.repository';

import { GenderSeeder } from './seeders/gender.seeder';
import { CountrySeeder } from './seeders/country.seeder';
import { PermissionSeeder } from './seeders/permission.seeder';
import { RoleSeeder } from './seeders/role.seeder';
import { AccountStatusEntity } from './entities/accountstatus.entity';
import { AccountStatusRepository } from './repositories/accountstatus.repository';
import { AccountStatusSeeder } from './seeders/accountstatus.seeder';
import { RegionEntity } from './entities/region.entity';
import { RegionRepository } from './repositories/region.repository';
import { RegionSeeder } from './seeders/region.seeder';
import { TimezoneEntity } from './entities/time-zone.entity';
import { TimezoneRepository } from './repositories/time-zone.repository';
import { TimezoneSeeder } from './seeders/time-zone.seeder';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CountryEntity,
      RegionEntity,
      GenderEntity,
      PermissionEntity,
      TimezoneEntity,
      RoleEntity,
      AccountStatusEntity,
    ]),
    SeedingModule.forFeature([
      new GenderSeeder(),
      new CountrySeeder(),
      new RegionSeeder(),
      new TimezoneSeeder(),
      new PermissionSeeder(),
      new RoleSeeder(),
      new AccountStatusSeeder(),
    ]),
  ],
  providers: [
    CountryRepository,
    RegionRepository,
    TimezoneRepository,
    GenderRepository,
    PermissionRepository,
    RoleRepository,
    AccountStatusRepository,
  ],
  exports: [
    CountryRepository,
    RegionRepository,
    TimezoneRepository,
    GenderRepository,
    PermissionRepository,
    RoleRepository,
    AccountStatusRepository,
  ],
})
export class LibraryModule {}
