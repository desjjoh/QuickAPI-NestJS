import { ApiProperty } from '@nestjs/swagger';
import { PhoneEntity } from '../entities/phone.entity';

export class PhoneDto {
  @ApiProperty({
    example: 'CA',
    description:
      'ISO 3166-1 alpha-2 country code linked to the country reference data.',
  })
  public readonly phone_country_code: string;

  @ApiProperty({
    example: '+1',
    description: 'International calling code for the phone number country.',
  })
  public readonly phone_calling_code: string;

  @ApiProperty({
    example: '4165551234',
    description: 'National significant phone number without the calling code.',
  })
  public readonly phone_national_number: string;

  @ApiProperty({
    example: '+14165551234',
    description:
      'Complete phone number in E.164 format, including the calling code.',
  })
  public readonly phone_e164: string;

  public constructor(phone: PhoneEntity) {
    this.phone_country_code = phone.country.iso2;
    this.phone_calling_code = phone.phone_calling_code;
    this.phone_national_number = phone.phone_national_number;
    this.phone_e164 = phone.phone_e164;
  }
}
