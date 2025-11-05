import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column } from 'typeorm';

import { BaseEntity } from './_base.entity';

/**
 * @fileoverview
 * Represents a single item in the system.
 *
 * Extends {@link BaseEntity} to include shared metadata fields
 * such as `id`, `createdAt`, and `updatedAt`.
 *
 * ---
 * ### Database Table
 * | Column       | Type      | Constraints           |
 * |--------------|-----------|-----------------------|
 * | id           | int       | PK, Auto Increment    |
 * | name         | varchar   | Not Null, 3–120 chars |
 * | price        | decimal   | Not Null, ≥ 0         |
 * | description  | text      | Nullable              |
 * | created_at   | datetime  | Auto-generated        |
 * | updated_at   | datetime  | Auto-generated        |
 */
@Entity({ name: 'items' })
export class ItemEntity extends BaseEntity {
  /**
   * Human-readable name of the item.
   *
   * @example "Mechanical Keyboard"
   */
  @ApiProperty({
    description: 'The name of the item (3–120 characters).',
    minLength: 3,
    maxLength: 120,
    example: 'Mechanical Keyboard',
  })
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  /**
   * Monetary price of the item.
   *
   * @example 149.99
   */
  @ApiProperty({
    description: 'The price of the item (must be non-negative).',
    minimum: 0,
    example: 149.99,
  })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  /**
   * Optional text description of the item.
   *
   * @example "Hot-swappable switches and RGB lighting"
   */
  @ApiProperty({
    description: 'Optional description for the item.',
    required: false,
    example: 'Hot-swappable switches and RGB lighting',
  })
  @Column({ type: 'text', nullable: true })
  description?: string | null;
}
