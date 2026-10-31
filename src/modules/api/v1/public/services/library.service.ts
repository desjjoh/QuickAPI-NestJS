import { LibraryReferenceService } from '@/modules/domain/library/services/library-reference.service';
import { IdentityCatalogService } from '@/modules/domain/identity/services/identity-catalog.service';
import { Injectable } from '@nestjs/common';

import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { BaseCountryDto } from '@/modules/domain/library/models/country.model';
import { GenderEntity } from '@/modules/domain/identity/entities/gender.entity';
import { BaseGenderDto } from '@/modules/domain/identity/models/gender.model';
import { BaseRoleDto } from '@/modules/domain/identity/models/role.model';
import { RoleEntity } from '@/modules/domain/identity/entities/role.entity';
import { AccountStatusEntity } from '@/modules/domain/identity/entities/accountstatus.entity';
import { BaseAccountStatusDto } from '@/modules/domain/identity/models/status.model';
import { TimezoneEntity } from '@/modules/domain/library/entities/time-zone.entity';
import { BaseTimezoneDto } from '@/modules/domain/library/models/time-zone.model';

@Injectable()
export class LibraryService {
  public constructor(
    private readonly library: LibraryReferenceService,
    private readonly identity: IdentityCatalogService,
  ) {}

  public async getCountries(): Promise<BaseCountryDto[]> {
    const countries: CountryEntity[] = await this.library.getCountries();

    return countries.map((e: CountryEntity) => new BaseCountryDto(e));
  }

  public async getTimezones(): Promise<BaseTimezoneDto[]> {
    const timezones: TimezoneEntity[] = await this.library.getTimezones();

    return timezones.map((e: TimezoneEntity) => new BaseTimezoneDto(e));
  }

  public async getGenders(): Promise<BaseGenderDto[]> {
    const genders: GenderEntity[] = await this.identity.getGenders();

    return genders.map((e: GenderEntity) => new BaseGenderDto(e));
  }

  public async getRoles(): Promise<BaseRoleDto[]> {
    const roles: RoleEntity[] = await this.identity.getRoles();

    return roles.map((role: RoleEntity) => new BaseRoleDto(role));
  }

  public async getAccountStatuses(): Promise<BaseAccountStatusDto[]> {
    const statuses: AccountStatusEntity[] =
      await this.identity.getAccountStatuses();

    return statuses.map(
      (role: AccountStatusEntity) => new BaseAccountStatusDto(role),
    );
  }
}
