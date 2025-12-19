import { Entity, Column } from 'typeorm';

import { BaseEntity } from '@/library/entities/base.entity';

@Entity('items')
export class ItemEntity extends BaseEntity {
  @Column({ type: 'text' })
  public readonly name!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  public readonly price!: number;

  @Column({ type: 'text', nullable: true })
  public readonly description?: string | null;
}
