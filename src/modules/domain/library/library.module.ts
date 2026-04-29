import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SeedingModule } from '@/modules/system/seeder/seeder.module';

import { CountryEntity } from './entities/country.entity';
import { GenderEntity } from './entities/gender.entity';

import { GenderSeeder } from './seeders/gender.seeder';
import { CountrySeeder } from './seeders/country.seeder';

import { GenderRepository } from './repositories/gender.repository';
import { CountryRepository } from './repositories/country.repository';
import { PermissionSeeder } from './seeders/permission.seeder';
import { RoleSeeder } from './seeders/role.seeder';
import { PermissionEntity } from './entities/permission.entity';
import { RoleEntity } from './entities/role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CountryEntity,
      GenderEntity,
      PermissionEntity,
      RoleEntity,
    ]),
    SeedingModule.forFeature([
      new GenderSeeder(),
      new CountrySeeder(),
      new PermissionSeeder(),
      new RoleSeeder(),
    ]),
  ],
  providers: [CountryRepository, GenderRepository],
  exports: [CountryRepository, GenderRepository],
})
export class LibraryModule {}
