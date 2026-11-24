import { LibraryReferenceService } from '@/modules/domain/library/services/library-reference.service';
import { IdentityCatalogService } from '@/modules/domain/identity/services/identity-catalog.service';
import { Injectable } from '@nestjs/common';

import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { BaseCountryDto } from '@/modules/domain/library/models/country.model';
import { GenderEntity } from '@/modules/domain/identity/entities/gender.entity';
import { BaseGenderDto } from '@/modules/domain/identity/models/gender.model';
import { TimezoneEntity } from '@/modules/domain/library/entities/time-zone.entity';
import { BaseTimezoneDto } from '@/modules/domain/library/models/time-zone.model';
import type { LibraryStartupDto } from '../models/library-startup.model';

@Injectable()
export class LibraryService {
  public constructor(
    private readonly library: LibraryReferenceService,
    private readonly identity: IdentityCatalogService,
  ) {}

  public async getStartup(): Promise<LibraryStartupDto> {
    const [countries, genders, timezones] = await Promise.all([
      this.getCountries(),
      this.getGenders(),
      this.getTimezones(),
    ]);

    return { countries, genders, timezones };
  }

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
}
