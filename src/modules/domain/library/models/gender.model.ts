import { ApiProperty } from '@nestjs/swagger';
import { GenderEntity } from '../entities/gender.entity';
import { BaseModel } from '@/common/models/base.model';

export class GenderDto extends BaseModel {
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
    super(gender);

    this.key = gender.key;
    this.label = gender.label;
  }
}
