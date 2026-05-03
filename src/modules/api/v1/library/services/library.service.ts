import { Injectable } from '@nestjs/common';

import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { BaseCountryDto } from '@/modules/domain/library/models/country.model';
import { GenderEntity } from '@/modules/domain/library/entities/gender.entity';
import { BaseGenderDto } from '@/modules/domain/library/models/gender.model';
import { CountryRepository } from '@/modules/domain/library/repositories/country.repository';
import { GenderRepository } from '@/modules/domain/library/repositories/gender.repository';
import { RoleRepository } from '@/modules/domain/library/repositories/role.repository';
import { BaseRoleDto } from '@/modules/domain/library/models/role.model';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';

@Injectable()
export class LibraryService {
  public constructor(
    private readonly countryRepository: CountryRepository,
    private readonly genderRepository: GenderRepository,
    private readonly roleRepository: RoleRepository,
  ) {}

  public async getCountries(): Promise<BaseCountryDto[]> {
    const countries: CountryEntity[] = await this.countryRepository.findAll();
    return countries.map((e: CountryEntity) => new BaseCountryDto(e));
  }

  public async getGenders(): Promise<BaseGenderDto[]> {
    const genders: GenderEntity[] = await this.genderRepository.findAll();
    return genders.map((e: GenderEntity) => new BaseGenderDto(e));
  }

  public async getRoles(): Promise<BaseRoleDto[]> {
    const roles: RoleEntity[] = await this.roleRepository.findAll();
    return roles.map((role: RoleEntity) => new BaseRoleDto(role));
  }
}
