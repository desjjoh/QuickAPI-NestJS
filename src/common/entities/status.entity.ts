import { Column, Index } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';

export class StatusEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  public readonly key!: string;

  @Column({ type: 'text' })
  public readonly label!: string;

  @Column({ type: 'text', nullable: true })
  public readonly description!: string | null;
}
