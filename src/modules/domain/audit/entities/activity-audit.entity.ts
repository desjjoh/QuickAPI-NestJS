import { BaseEntity } from '@/common/entities/base.entity';
import { Column, Entity, Index } from 'typeorm';

type RedactedAuditData = Record<string, unknown>;

@Entity('activity_audits')
@Index('IDX_activity_audits_actor_time', ['actor_user_id', 'occurred_at'])
@Index('IDX_activity_audits_subject_time', ['subject_user_id', 'occurred_at'])
@Index('IDX_activity_audits_entity_time', [
  'entity_type',
  'entity_id',
  'occurred_at',
])
@Index('IDX_activity_audits_event_time', ['event', 'occurred_at'])
export class ActivityAuditEntity extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 32 })
  public readonly category!: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  public readonly event!: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  public readonly outcome!: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  public readonly actor_type!: string;

  @Index()
  @Column({ type: 'varchar', length: 16, nullable: true })
  public readonly actor_user_id!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 16, nullable: true })
  public readonly subject_user_id!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  public readonly entity_type!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  public readonly entity_id!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  public readonly request_id!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 16, nullable: true })
  public readonly session_id!: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  public readonly ip_address!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  public readonly user_agent!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  public readonly http_method!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  public readonly route!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  public readonly failure_reason!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  public readonly failure_code!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  public readonly source!: string;

  @Index('IDX_activity_audits_occurred_at')
  @Column({ type: 'datetime', precision: 6 })
  public readonly occurred_at!: Date;

  @Column({ type: 'json', nullable: true })
  public readonly before!: RedactedAuditData | null;

  @Column({ type: 'json', nullable: true })
  public readonly after!: RedactedAuditData | null;

  @Column({ type: 'json', nullable: true })
  public readonly changes!: RedactedAuditData | null;

  @Column({ type: 'json', nullable: true })
  public readonly metadata!: RedactedAuditData | null;
}
