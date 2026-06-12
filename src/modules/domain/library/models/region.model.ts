import { ApiProperty, IntersectionType } from '@nestjs/swagger';

import { BaseModel } from '@/common/models/base.model';
import { RegionEntity } from '../entities/region.entity';

export class RegionDto {
  @ApiProperty({
    example: 'ontario',
    description:
      'Stable region key used to identify the province, state, or territory in code and API workflows.',
  })
  public readonly key: string;

  @ApiProperty({
    example: 'ON',
    description:
      'Country-specific short code used by postal services, forms, and address displays.',
  })
  public readonly code: string;

  @ApiProperty({
    example: 'Ontario',
    description: 'Human-readable province, state, or territory name.',
  })
  public readonly label: string;

  @ApiProperty({
    example: 'canada',
    description: 'Stable country key this region belongs to.',
  })
  public readonly country: string;

  public constructor(region: RegionEntity) {
    this.key = region.key;
    this.code = region.code;
    this.label = region.label;
    this.country = region.country?.key ?? '';
  }
}

export class BaseRegionDto extends IntersectionType(BaseModel, RegionDto) {
  public constructor(region: RegionEntity) {
    super();

    Object.assign(this, new BaseModel(region), new RegionDto(region));
  }
}
