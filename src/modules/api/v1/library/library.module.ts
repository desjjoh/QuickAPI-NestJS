import { Module } from '@nestjs/common';
import { GenderController } from './controllers/library.controller';
import { LibraryModule } from '@/modules/domain/library/library.module';
import { GenderRepository } from '@/modules/domain/library/repositories/gender.repository';
import { CountryRepository } from '@/modules/domain/library/repositories/country.repository';
import { RoleRepository } from '@/modules/domain/library/repositories/role.repository';

@Module({
  imports: [LibraryModule],
  providers: [GenderRepository, CountryRepository, RoleRepository],
  controllers: [GenderController],
})
export class LibraryApiModule {}
