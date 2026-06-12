import { ApiProperty } from '@nestjs/swagger';
import { CountryEntity } from '../entities/country.entity';
import { BaseModel } from '@/common/models/base.model';
import { IntersectionType } from '@nestjs/swagger';
import { BaseRegionDto } from './region.model';
import { RegionEntity } from '../entities/region.entity';
export class CountryDto {
  @ApiProperty({
    example: 'canada',
    description:
      'Stable application key used to identify the country in code, seed data, and API workflows.',
  })
  public readonly key: string;

  @ApiProperty({
    example: 'Canada',
    description: 'Human-readable country name displayed to users.',
  })
  public readonly label: string;

  @ApiProperty({
    example: 'CA',
    description: 'Two-letter ISO 3166-1 alpha-2 country code.',
  })
  public readonly iso2: string;

  @ApiProperty({
    example: 'CAN',
    description: 'Three-letter ISO 3166-1 alpha-3 country code.',
  })
  public readonly iso3: string;

  @ApiProperty({
    example: '1',
    description:
      'International telephone calling code used for phone number formatting and validation.',
  })
  public readonly calling_code: string;

  @ApiProperty({
    type: [BaseRegionDto],
    description:
      'Available provinces, states, or territories for country-specific address forms.',
  })
  public readonly regions: BaseRegionDto[];

  @ApiProperty({
    example: '2015550123',
    description:
      'Digits-only example national phone number used as a country-specific input placeholder.',
  })
  public readonly phone_national_placeholder: string;

  @ApiProperty({
    example: '^[2-9]\\d{2}[2-9]\\d{6}$',
    description:
      'Regular expression used to validate the digits-only national phone number for the selected country.',
  })
  public readonly phone_national_pattern: string;

  @ApiProperty({
    example: [3, 3, 4],
    type: [Number],
    description:
      'Ordered digit group sizes used to format the national phone number for display.',
  })
  public readonly phone_format_groups: number[];

  @ApiProperty({
    example: 'K1A0B1',
    description:
      'Example postal or ZIP code used as a country-specific input placeholder.',
  })
  public readonly postal_code_placeholder: string;

  @ApiProperty({
    example:
      '^[ABCEGHJ-NPRSTVXY]\\d[ABCEGHJ-NPRSTV-Z][ -]?\\d[ABCEGHJ-NPRSTV-Z]\\d$',
    description:
      'Regular expression used to validate the postal or ZIP code for the selected country.',
  })
  public readonly postal_code_pattern: string;

  @ApiProperty({
    example: [3, 3],
    type: [Number],
    description:
      'Ordered character group sizes used to format the postal or ZIP code for display.',
  })
  public readonly postal_code_format_groups: number[];

  @ApiProperty({
    example: ' ',
    description:
      'Separator inserted between postal or ZIP code format groups for display.',
  })
  public readonly postal_code_format_separator: string;

  public constructor(country: CountryEntity) {
    this.key = country.key;
    this.label = country.label;
    this.iso2 = country.iso2;
    this.iso3 = country.iso3;

    this.regions =
      country.regions?.map(
        (region: RegionEntity) => new BaseRegionDto(region),
      ) ?? [];

    this.calling_code = country.calling_code;
    this.phone_national_placeholder = country.phone_national_placeholder;
    this.phone_national_pattern = country.phone_national_pattern;
    this.phone_format_groups = country.phone_format_groups;

    this.postal_code_placeholder = country.postal_code_placeholder;
    this.postal_code_pattern = country.postal_code_pattern;
    this.postal_code_format_groups = country.postal_code_format_groups;
    this.postal_code_format_separator = country.postal_code_format_separator;
  }
}

export class BaseCountryDto extends IntersectionType(BaseModel, CountryDto) {
  public constructor(country: CountryEntity) {
    super();

    Object.assign(this, new BaseModel(country), new CountryDto(country));
  }
}
