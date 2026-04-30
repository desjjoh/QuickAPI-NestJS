import { ApiProperty } from '@nestjs/swagger';
import { CountryEntity } from '../entities/country.entity';

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

  public constructor(country: CountryEntity) {
    this.key = country.key;
    this.label = country.label;
    this.iso2 = country.iso2;
    this.iso3 = country.iso3;
    this.calling_code = country.calling_code;
  }
}
