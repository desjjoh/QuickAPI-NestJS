import { ApiProperty } from '@nestjs/swagger';
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class BaseEntity {
  @ApiProperty({
    description: 'Unique numeric identifier for the record.',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  public readonly id!: number;

  @ApiProperty({
    description: 'Timestamp when the record was created.',
    example: '2025-11-04T00:25:31.510Z',
  })
  @CreateDateColumn({ name: 'created_at' })
  public readonly createdAt!: Date;

  @ApiProperty({
    description: 'Timestamp when the record was last updated.',
    example: '2025-11-04T00:25:31.510Z',
  })
  @UpdateDateColumn({ name: 'updated_at' })
  public readonly updatedAt!: Date;
}
