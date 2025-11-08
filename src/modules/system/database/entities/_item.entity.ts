import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column } from 'typeorm';

import { BaseEntity } from './_base.entity';

@Entity({ name: 'items' })
export class ItemEntity extends BaseEntity {
  @ApiProperty({
    description: 'The name of the item (3–120 characters).',
    minLength: 3,
    maxLength: 120,
    example: 'Mechanical Keyboard',
  })
  @Column({ type: 'varchar', length: 120 })
  public readonly name!: string;

  @ApiProperty({
    description: 'The price of the item (must be non-negative).',
    minimum: 0,
    example: 149.99,
  })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  public readonly price!: number;

  @ApiProperty({
    description: 'Optional description for the item.',
    required: false,
    example: 'Hot-swappable switches and RGB lighting',
  })
  @Column({ type: 'text', nullable: true })
  public readonly description?: string | null;
}
