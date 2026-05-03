import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateAddressDto {
  @ApiProperty({
    example: '123 Main Street',
    description:
      'Primary street address line, such as the street number and street name.',
  })
  @IsString()
  @IsNotEmpty()
  public readonly address_line_1!: string;

  @ApiPropertyOptional({
    example: 'Unit 4B',
    description:
      'Secondary street address line, such as an apartment, suite, unit, building number, or delivery instruction.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public readonly address_line_2?: string | null;

  @ApiProperty({
    example: 'Ottawa',
    description: 'City, town, or locality for the address.',
  })
  @IsString()
  @IsNotEmpty()
  public readonly city!: string;

  @ApiProperty({
    example: 'Ontario',
    description: 'Province, state, territory, or region for the address.',
  })
  @IsString()
  @IsNotEmpty()
  public readonly region!: string;

  @ApiProperty({
    example: 'K1A 0B1',
    description: 'Postal or ZIP code for the address.',
  })
  @IsString()
  @IsNotEmpty()
  public readonly postal_code!: string;

  @ApiProperty({
    example: 'W7Kb4TWo3KsqxYdA',
    description:
      'Unique identifier of the country selected from the configured country reference data.',
  })
  @IsString()
  @IsNotEmpty()
  public readonly country_id!: string;
}
