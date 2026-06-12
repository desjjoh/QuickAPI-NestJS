import { ApiProperty } from '@nestjs/swagger';
import { CountryEntity } from '../entities/country.entity';
import { BaseModel } from '@/common/models/base.model';
import { IntersectionType } from '@nestjs/swagger';
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

  public constructor(country: CountryEntity) {
    this.key = country.key;
    this.label = country.label;
    this.iso2 = country.iso2;
    this.iso3 = country.iso3;
    this.calling_code = country.calling_code;

    this.phone_national_placeholder = country.phone_national_placeholder;
    this.phone_national_pattern = country.phone_national_pattern;
    this.phone_format_groups = country.phone_format_groups;
  }
}

export class BaseCountryDto extends IntersectionType(BaseModel, CountryDto) {
  public constructor(country: CountryEntity) {
    super();

    Object.assign(this, new BaseModel(country), new CountryDto(country));
  }
}
