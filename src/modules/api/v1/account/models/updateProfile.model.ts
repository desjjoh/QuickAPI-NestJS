import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    example: 'Jane',
    description: 'The user’s legal or given first name.',
  })
  @IsString()
  @MaxLength(100)
  public readonly first_name!: string;

  @ApiProperty({
    example: 'Doe',
    description: 'The user’s legal or family last name.',
  })
  @IsString()
  @MaxLength(100)
  public readonly last_name!: string;

  @ApiProperty({
    example: 'Janey',
    nullable: true,
    description:
      'Optional preferred name used for display when different from the legal first name.',
    maxLength: 100,
  })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  public readonly preferred_name!: string | null;

  @ApiProperty({
    example: '1990-01-15',
    description: 'The user’s date of birth in ISO date format.',
  })
  @IsDateString()
  public readonly dob!: string;

  @ApiProperty({
    example: 'SUwDyXR7iSBnyWmr',
    description: 'The unique NanoID of the selected gender reference record.',
    minLength: 16,
    maxLength: 16,
    pattern: '^[0-9A-Za-z]{16}$',
  })
  @IsString()
  @IsNotEmpty()
  @Length(16, 16)
  @Matches(/^[0-9A-Za-z]{16}$/, {
    message: 'Gender ID must contain only letters and numbers.',
  })
  public readonly gender_id!: string;

  @ApiProperty({
    example:
      'Builder, tester, and lifelong API tinkerer. Usually ships before coffee gets cold.',
    nullable: true,
    description: 'Optional plain-text profile bio.',
    maxLength: 255,
  })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(255)
  public readonly bio!: string | null;
}

export class UpdateProfileCountryDto {
  @ApiProperty({
    example: 'SUwDyXR7iSBnyWmr',
    description: 'The unique NanoID of the selected country reference record.',
    minLength: 16,
    maxLength: 16,
    pattern: '^[0-9A-Za-z]{16}$',
  })
  @IsString()
  @IsNotEmpty()
  @Length(16, 16)
  @Matches(/^[0-9A-Za-z]{16}$/, {
    message: 'Country ID must contain only letters and numbers.',
  })
  public readonly country_id!: string;
}

export class UpdateProfileTimezoneDto {
  @ApiProperty({
    example: 'America/Toronto',
    description:
      'Stable IANA time zone key selected from the configured time zone reference data.',
    maxLength: 64,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  public readonly timezone_id!: string;
}
