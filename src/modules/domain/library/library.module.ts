import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SeedingModule } from '@/modules/system/seeder/seeder.module';

import { CountryEntity } from './entities/country.entity';
import { GenderEntity } from './entities/gender.entity';
import { PermissionEntity } from './entities/permission.entity';
import { RoleEntity } from './entities/role.entity';
import { ImageEntity } from './entities/image.entity';

import { PermissionRepository } from './repositories/permission.repository';
import { RoleRepository } from './repositories/role.repository';
import { GenderRepository } from './repositories/gender.repository';
import { CountryRepository } from './repositories/country.repository';

import { GenderSeeder } from './seeders/gender.seeder';
import { CountrySeeder } from './seeders/country.seeder';
import { PermissionSeeder } from './seeders/permission.seeder';
import { RoleSeeder } from './seeders/role.seeder';
import { ImageService } from './services/image.service';
import { ImageRepository } from './repositories/image.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CountryEntity,
      GenderEntity,
      PermissionEntity,
      RoleEntity,
      ImageEntity,
    ]),
    SeedingModule.forFeature([
      new GenderSeeder(),
      new CountrySeeder(),
      new PermissionSeeder(),
      new RoleSeeder(),
    ]),
  ],
  providers: [
    CountryRepository,
    GenderRepository,
    PermissionRepository,
    RoleRepository,
    ImageService,
    ImageRepository,
  ],
  exports: [
    CountryRepository,
    GenderRepository,
    PermissionRepository,
    RoleRepository,
    ImageService,
  ],
})
export class LibraryModule {}
