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
    example: '+16135550123',
    nullable: true,
    description:
      'Primary phone number for the authenticated user in E.164 format. Must include the leading + and country calling code.',
    minLength: 8,
    maxLength: 16,
    pattern: '^\\+[1-9]\\d{1,14}$',
  })
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message:
      'phoneE164 must be a valid E.164 phone number, including the leading + and country calling code.',
  })
  public readonly alternate_phone_e164!: string | null;
}
