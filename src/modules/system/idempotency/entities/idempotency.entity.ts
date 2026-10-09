import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('request_idempotency')
export class IdempotencyEntity {
  @PrimaryColumn({ type: 'char', length: 64 })
  public readonly scope_hash!: string;

  @Column({ type: 'varchar', length: 128 })
  public readonly actor_id!: string;

  @Column({ type: 'varchar', length: 128 })
  public readonly operation!: string;

  @Column({ type: 'varchar', length: 512 })
  public readonly route!: string;

  @Column({ type: 'char', length: 64 })
  public readonly fingerprint!: string;

  @Column({ type: 'varchar', length: 16 })
  public readonly state!: 'processing' | 'completed';

  @Column({ type: 'int', nullable: true })
  public readonly response_status!: number | null;

  @Column({ type: 'json', nullable: true })
  public readonly response_body!: unknown;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public readonly response_identity!: string | null;

  @Index('IDX_idempotency_expiry')
  @Column({ type: 'datetime', precision: 3 })
  public readonly expires_at!: Date;
}
