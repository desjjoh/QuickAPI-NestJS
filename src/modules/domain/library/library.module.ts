import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SeedingModule } from '@/modules/system/seeder/seeder.module';

import { CountryEntity } from './entities/country.entity';

import { CountryRepository } from './repositories/country.repository';

import { CountrySeeder } from './seeders/country.seeder';
import { RegionEntity } from './entities/region.entity';
import { RegionRepository } from './repositories/region.repository';
import { RegionSeeder } from './seeders/region.seeder';
import { TimezoneEntity } from './entities/time-zone.entity';
import { TimezoneRepository } from './repositories/time-zone.repository';
import { TimezoneSeeder } from './seeders/time-zone.seeder';

@Module({
  imports: [
    TypeOrmModule.forFeature([CountryEntity, RegionEntity, TimezoneEntity]),
    SeedingModule.forFeature('Library', [
      new CountrySeeder(),
      new RegionSeeder(),
      new TimezoneSeeder(),
    ]),
  ],
  providers: [CountryRepository, RegionRepository, TimezoneRepository],
  exports: [CountryRepository, RegionRepository, TimezoneRepository],
})
export class LibraryModule {}
