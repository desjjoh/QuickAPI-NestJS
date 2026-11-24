import { BaseGenderDto } from '@/modules/domain/identity/models/gender.model';
import { BaseCountryDto } from '@/modules/domain/library/models/country.model';
import { BaseTimezoneDto } from '@/modules/domain/library/models/time-zone.model';
import { ApiProperty } from '@nestjs/swagger';

export class LibraryStartupDto {
  @ApiProperty({ type: [BaseCountryDto] })
  public readonly countries!: BaseCountryDto[];

  @ApiProperty({ type: [BaseGenderDto] })
  public readonly genders!: BaseGenderDto[];

  @ApiProperty({ type: [BaseTimezoneDto] })
  public readonly timezones!: BaseTimezoneDto[];
}
