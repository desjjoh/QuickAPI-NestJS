import { ApiProperty, IntersectionType } from '@nestjs/swagger';

import { BaseModel } from '@/common/models/base.model';
import { TimezoneEntity } from '../entities/time-zone.entity';

export class TimezoneDto {
  @ApiProperty({
    example: 'America/Toronto',
    description:
      'Stable IANA time zone key used by front-end and back-end workflows.',
  })
  public readonly key: string;

  @ApiProperty({
    example: '(GMT-05:00) Eastern Standard Time - America/Toronto',
    description: 'Human-readable English label for development clarity.',
  })
  public readonly label: string;

  @ApiProperty({ example: 'Eastern Standard Time' })
  public readonly long_name: string;

  @ApiProperty({ example: 'EST' })
  public readonly short_name: string;

  @ApiProperty({ example: -300 })
  public readonly offset_minutes: number;

  @ApiProperty({ example: 'GMT-05:00' })
  public readonly offset_label: string;

  @ApiProperty({ example: 'America' })
  public readonly region: string;

  @ApiProperty({ example: 'Toronto' })
  public readonly exemplar_city: string;

  public constructor(timezone: TimezoneEntity) {
    this.key = timezone.key;
    this.label = timezone.label;
    this.long_name = timezone.long_name;
    this.short_name = timezone.short_name;
    this.offset_minutes = timezone.offset_minutes;
    this.offset_label = timezone.offset_label;
    this.region = timezone.region;
    this.exemplar_city = timezone.exemplar_city;
  }
}

export class BaseTimezoneDto extends IntersectionType(BaseModel, TimezoneDto) {
  public constructor(timezone: TimezoneEntity) {
    super();

    Object.assign(this, new BaseModel(timezone), new TimezoneDto(timezone));
  }
}
