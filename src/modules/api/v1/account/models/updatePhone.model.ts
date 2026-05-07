// src/modules/api/v1/account/dto/update-phone.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { Matches, ValidateIf } from 'class-validator';

export class UpdatePhoneDto {
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
  public readonly phone_e164!: string | null;
}
