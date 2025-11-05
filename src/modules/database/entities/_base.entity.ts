import { ApiProperty } from '@nestjs/swagger';
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * @fileoverview
 * Abstract base entity providing shared metadata columns
 * for all database models.
 *
 * This class defines the standard primary key (`id`),
 * creation timestamp (`createdAt`), and update timestamp (`updatedAt`)
 * used across all entities.
 *
 * ---
 * ### Purpose
 * - Promotes consistency across all database tables.
 * - Simplifies entity definitions via inheritance.
 * - Provides a single location to extend later with audit fields.
 *
 * ---
 * ### Example
 * ```ts
 * @Entity({ name: 'items' })
 * export class ItemEntity extends BaseEntity {
 *   @Column()
 *   name: string;
 * }
 * ```
 */
export abstract class BaseEntity {
  /**
   * Unique numeric identifier for the record.
   *
   * @example 1
   */
  @ApiProperty({
    description: 'Unique numeric identifier for the record.',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  public readonly id!: number;

  /**
   * Timestamp when the record was first created.
   *
   * Automatically populated by the database.
   *
   * @example "2025-11-04T00:25:31.510Z"
   */
  @ApiProperty({
    description: 'Timestamp when the record was created.',
    example: '2025-11-04T00:25:31.510Z',
  })
  @CreateDateColumn({ name: 'created_at' })
  public readonly createdAt!: Date;

  /**
   * Timestamp when the record was last updated.
   *
   * Automatically updated by the database.
   *
   * @example "2025-11-04T00:25:31.510Z"
   */
  @ApiProperty({
    description: 'Timestamp when the record was last updated.',
    example: '2025-11-04T00:25:31.510Z',
  })
  @UpdateDateColumn({ name: 'updated_at' })
  public readonly updatedAt!: Date;
}
