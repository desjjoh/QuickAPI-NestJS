import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressEntity } from '../entities/address.entity';
import { WithBaseModel } from './base.model';

export class AddressDto {
  @ApiProperty({
    example: '123 Main Street',
    description:
      'Primary street address line, such as the street number and street name.',
  })
  public readonly address_line_1: string;

  @ApiPropertyOptional({
    example: 'Unit 4B',
    description:
      'Secondary street address line, such as an apartment, suite, unit, or building number.',
    nullable: true,
  })
  public readonly address_line_2: string | null;

  @ApiProperty({
    example: 'Ottawa',
    description: 'City, town, or locality for the address.',
  })
  public readonly city: string;

  @ApiProperty({
    example: 'Ontario',
    description: 'Province, state, territory, or region for the address.',
  })
  public readonly region: string;

  @ApiProperty({
    example: 'K1A 0B1',
    description: 'Postal or ZIP code for the address.',
  })
  public readonly postal_code: string;

  @ApiProperty({
    example: 'canada',
    description:
      'Stable country key selected from the configured country reference data.',
  })
  public readonly country: string;

  public constructor(address: AddressEntity) {
    this.address_line_1 = address.address_line_1;
    this.address_line_2 = address.address_line_2 ?? null;
    this.city = address.city;
    this.region = address.region;
    this.postal_code = address.postal_code;
    this.country = address.country.key;
  }
}

export class BaseAddressDto extends WithBaseModel(AddressDto) {}
