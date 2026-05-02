import { ApiProperty } from '@nestjs/swagger';
import { GenderEntity } from '../entities/gender.entity';
import { WithBaseModel } from '@/common/models/base.model';

export class GenderDto {
  @ApiProperty({
    example: 'female',
    description:
      'Stable application key used to identify the gender option in code, seed data, and API workflows.',
  })
  public readonly key: string;

  @ApiProperty({
    example: 'Female',
    description: 'Human-readable gender label displayed to users.',
  })
  public readonly label: string;

  public constructor(gender: GenderEntity) {
    this.key = gender.key;
    this.label = gender.label;
  }
}

export class BaseGenderDto extends WithBaseModel(GenderDto) {}
