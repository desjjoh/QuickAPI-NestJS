import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('storage_deletion_intents')
@Index('IDX_storage_deletion_due', ['state', 'available_at'])
export class StorageDeletionIntentEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  public readonly id!: string;

  @Column({ type: 'varchar', length: 1024 })
  public readonly storage_key!: string;

  @Column({ type: 'varchar', length: 32 })
  public readonly reason!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public readonly request_id!: string | null;

  @Column({ type: 'varchar', length: 16 })
  public readonly state!: 'pending' | 'completed' | 'blocked' | 'failed';

  @Column({ type: 'int', unsigned: true, default: 0 })
  public readonly attempts!: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public readonly last_error!: string | null;

  @Column({ type: 'boolean', default: false })
  public readonly dlq_forwarded!: boolean;

  @Column({ type: 'datetime', precision: 3 })
  public readonly created_at!: Date;

  @Column({ type: 'datetime', precision: 3 })
  public readonly available_at!: Date;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  public readonly completed_at!: Date | null;
}
