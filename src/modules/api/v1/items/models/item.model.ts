import { ApiProperty } from '@nestjs/swagger';

import { BaseModel } from '@/library/models/base.model';

import { ItemEntity } from '@/modules/domain/items/entities/item.entity';

export class ItemDto extends BaseModel {
  @ApiProperty({
    description: 'Human-readable name of the item.',
    example: 'Iron Sword',
  })
  public readonly name!: string;

  @ApiProperty({
    description: 'Item price expressed in the system currency.',
    example: 49.99,
    type: Number,
    format: 'decimal',
  })
  public readonly price!: number;

  @ApiProperty({
    description: 'Optional description providing additional item details.',
    example: 'A finely crafted steel blade.',
    required: false,
    nullable: true,
  })
  public readonly description?: string;

  constructor(entity: ItemEntity) {
    super(entity);

    this.name = entity.name;
    this.price = Number(entity.price);
    this.description = entity.description ?? undefined;
  }
}
