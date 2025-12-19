import { ApiProperty } from '@nestjs/swagger';

import { BaseModel } from '@/library/models/base.model';

import { ItemEntity } from '@/modules/domain/items/entities/item.entity';

export class Item extends BaseModel {
  @ApiProperty({
    description: 'Human-readable name of the item.',
    example: 'Iron Sword',
  })
  public readonly name!: string;

  @ApiProperty({
    description: 'Optional description providing additional item details.',
    example: 'A finely crafted steel blade.',
    required: false,
    nullable: true,
  })
  public readonly description?: string | null;

  @ApiProperty({
    description: 'Item price expressed in the system currency.',
    example: 49.99,
    type: Number,
    format: 'decimal',
  })
  public readonly price!: number;

  constructor(entity: ItemEntity) {
    super(entity);

    this.name = entity.name;
    this.description = entity.description;
    this.price = entity.price;
  }
}
