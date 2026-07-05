import { ApiProperty } from '@nestjs/swagger';
import { PhoneEntity } from '../entities/phone.entity';
import { BaseModel } from './base.model';

export class PhoneDto extends BaseModel {
  @ApiProperty({
    example: 'SUwDyXR7iSBnyWmr',
    description: 'The unique NanoID of the selected country reference record.',
    minLength: 16,
    maxLength: 16,
    pattern: '^[0-9A-Za-z]{16}$',
  })
  public readonly phone_country_id: string;

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
    super(phone);

    this.phone_country_id = phone.country.id;
    this.phone_calling_code = phone.phone_calling_code;
    this.phone_national_number = phone.phone_national_number;
    this.phone_e164 = phone.phone_e164;
  }
}
