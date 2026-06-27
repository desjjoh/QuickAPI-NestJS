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
import { AccountStatusRepository } from '@/modules/domain/library/repositories/accountstatus.repository';
import { AccountStatusEntity } from '@/modules/domain/library/entities/accountstatus.entity';
import { BaseAccountStatusDto } from '@/modules/domain/library/models/status.model';
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
    const countries: CountryEntity[] = await this.countryRepo.findAll();
    return countries.map((e: CountryEntity) => new BaseCountryDto(e));
  }

  public async getTimezones(): Promise<BaseTimezoneDto[]> {
    const timezones: TimezoneEntity[] = await this.timezoneRepo.findAll();
    return timezones.map((e: TimezoneEntity) => new BaseTimezoneDto(e));
  }

  public async getGenders(): Promise<BaseGenderDto[]> {
    const genders: GenderEntity[] = await this.genderRepo.findAll();
    return genders.map((e: GenderEntity) => new BaseGenderDto(e));
  }

  public async getRoles(): Promise<BaseRoleDto[]> {
    const roles: RoleEntity[] = await this.roleRepo.findAll();
    return roles.map((role: RoleEntity) => new BaseRoleDto(role));
  }

  public async getAccountStatuses(): Promise<BaseAccountStatusDto[]> {
    const statuses: AccountStatusEntity[] = await this.statusRepo.findAll();
    return statuses.map(
      (role: AccountStatusEntity) => new BaseAccountStatusDto(role),
    );
  }
}
