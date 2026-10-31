import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CountryEntity } from './entities/country.entity';

import { CountryRepository } from './repositories/country.repository';

import { RegionEntity } from './entities/region.entity';
import { RegionRepository } from './repositories/region.repository';
import { TimezoneEntity } from './entities/time-zone.entity';
import { TimezoneRepository } from './repositories/time-zone.repository';

import { LibraryReferenceService } from './services/library-reference.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CountryEntity, RegionEntity, TimezoneEntity]),
  ],
  providers: [
    LibraryReferenceService,
    CountryRepository,
    RegionRepository,
    TimezoneRepository,
  ],
  exports: [
    LibraryReferenceService,
    CountryRepository,
    RegionRepository,
    TimezoneRepository,
  ],
})
export class LibraryModule {}
