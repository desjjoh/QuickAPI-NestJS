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
import { AccountStatusEntity } from './entities/accountstatus.entity';
import { AccountStatusRepository } from './repositories/accountstatus.repository';
import { AccountStatusSeeder } from './seeders/accountstatus.seeder';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CountryEntity,
      GenderEntity,
      PermissionEntity,
      RoleEntity,
      AccountStatusEntity,
      ImageEntity,
    ]),
    SeedingModule.forFeature([
      new GenderSeeder(),
      new CountrySeeder(),
      new PermissionSeeder(),
      new RoleSeeder(),
      new AccountStatusSeeder(),
    ]),
  ],
  providers: [
    CountryRepository,
    GenderRepository,
    PermissionRepository,
    RoleRepository,
    AccountStatusRepository,
    ImageService,
    ImageRepository,
  ],
  exports: [
    CountryRepository,
    GenderRepository,
    PermissionRepository,
    RoleRepository,
    AccountStatusRepository,
    ImageService,
  ],
})
export class LibraryModule {}
