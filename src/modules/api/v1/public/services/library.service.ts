import { Injectable } from '@nestjs/common';

import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { BaseCountryDto } from '@/modules/domain/library/models/country.model';
import { GenderEntity } from '@/modules/domain/identity/entities/gender.entity';
import { BaseGenderDto } from '@/modules/domain/identity/models/gender.model';
import { CountryRepository } from '@/modules/domain/library/repositories/country.repository';
import { GenderRepository } from '@/modules/domain/identity/repositories/gender.repository';
import { RoleRepository } from '@/modules/domain/identity/repositories/role.repository';
import { BaseRoleDto } from '@/modules/domain/identity/models/role.model';
import { RoleEntity } from '@/modules/domain/identity/entities/role.entity';
import { AccountStatusRepository } from '@/modules/domain/identity/repositories/accountstatus.repository';
import { AccountStatusEntity } from '@/modules/domain/identity/entities/accountstatus.entity';
import { BaseAccountStatusDto } from '@/modules/domain/identity/models/status.model';
import { TimezoneRepository } from '@/modules/domain/library/repositories/time-zone.repository';
import { TimezoneEntity } from '@/modules/domain/library/entities/time-zone.entity';
import { BaseTimezoneDto } from '@/modules/domain/library/models/time-zone.model';

@Injectable()
export class LibraryService {
  public constructor(
    private readonly countryRepo: CountryRepository,
    private readonly genderRepo: GenderRepository,
    private readonly roleRepo: RoleRepository,
    private readonly statusRepo: AccountStatusRepository,
    private readonly timezoneRepo: TimezoneRepository,
  ) {}

  public async getCountries(): Promise<BaseCountryDto[]> {
    const countries: CountryEntity[] = await this.countryRepo.findAll(
      this.countryRepo.manager,
    );
    return countries.map((e: CountryEntity) => new BaseCountryDto(e));
  }

  public async getTimezones(): Promise<BaseTimezoneDto[]> {
    const timezones: TimezoneEntity[] = await this.timezoneRepo.findAll(
      this.timezoneRepo.manager,
    );
    return timezones.map((e: TimezoneEntity) => new BaseTimezoneDto(e));
  }

  public async getGenders(): Promise<BaseGenderDto[]> {
    const genders: GenderEntity[] = await this.genderRepo.findAll(
      this.genderRepo.manager,
    );
    return genders.map((e: GenderEntity) => new BaseGenderDto(e));
  }

  public async getRoles(): Promise<BaseRoleDto[]> {
    const roles: RoleEntity[] = await this.roleRepo.findAll(
      this.roleRepo.manager,
    );
    return roles.map((role: RoleEntity) => new BaseRoleDto(role));
  }

  public async getAccountStatuses(): Promise<BaseAccountStatusDto[]> {
    const statuses: AccountStatusEntity[] = await this.statusRepo.findAll(
      this.statusRepo.manager,
    );
    return statuses.map(
      (role: AccountStatusEntity) => new BaseAccountStatusDto(role),
    );
  }
}
