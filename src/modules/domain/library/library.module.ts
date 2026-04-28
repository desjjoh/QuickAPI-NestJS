import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CountryEntity } from './entities/country.entity';
import { GenderEntity } from './entities/gender.entity';
import { SeedingModule } from '@/modules/system/seeder/seeder.module';
import { GenderSeeder } from './seeders/gender.seeder';
import { CountrySeeder } from './seeders/countries.seeder';

@Module({
  imports: [
    TypeOrmModule.forFeature([CountryEntity, GenderEntity]),
    SeedingModule.forFeature([new GenderSeeder(), new CountrySeeder()]),
  ],
  providers: [],
  exports: [TypeOrmModule],
})
export class LibraryModule {}
