import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { ADMINISTRATION_REASON_CODES } from '@/config/administration.config';
import type { AdministrationReasonCode } from '@/config/administration.config';

/** Required justification shared by administration actions that change state. */
export class AdministrationActionDto {
  @ApiProperty({
    enum: ADMINISTRATION_REASON_CODES,
    description: 'Controlled reason for the administrative action.',
  })
  @IsEnum(ADMINISTRATION_REASON_CODES)
  public readonly reason_code!: AdministrationReasonCode;
}
