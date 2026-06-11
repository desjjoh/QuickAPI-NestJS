import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class UpdatePhoneDto {
  @ApiProperty({
    example: 'W7Kb4TWo3KsqxYdA',
    description:
      'Unique identifier of the country selected from the configured country reference data.',
  })
  @IsString()
  @IsNotEmpty()
  public readonly phone_country_id!: string;

  @ApiProperty({
    example: '+1',
    description: 'International calling code for the phone number country.',
    maxLength: 8,
    pattern: '^\\+[1-9]\\d{0,6}$',
  })
  @IsString()
  @MaxLength(8)
  @Matches(/^\+[1-9]\d{0,6}$/, {
    message: 'phone_calling_code must start with + and contain digits.',
  })
  public readonly phone_calling_code!: string;

  @ApiProperty({
    example: '4165551234',
    description: 'National significant phone number without the calling code.',
    maxLength: 20,
    pattern: '^\\d+$',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^\d+$/, {
    message: 'phone_national_number must contain digits only.',
  })
  public readonly phone_national_number!: string;

  @ApiProperty({
    example: '+14165551234',
    description:
      'Complete phone number in E.164 format, including the calling code.',
    minLength: 8,
    maxLength: 16,
    pattern: '^\\+[1-9]\\d{1,14}$',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message:
      'phone_e164 must be a valid E.164 phone number, including the leading + and country calling code.',
  })
  public readonly phone_e164!: string;
}
