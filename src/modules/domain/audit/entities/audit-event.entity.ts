import { BaseEntity } from '@/common/entities/base.entity';
import { Column, Entity, Index } from 'typeorm';

type RedactedAuditData = Record<string, unknown>;

@Entity('activity_audits')
@Index('IDX_activity_audits_actor_time', [
  'actor_type',
  'actor_id',
  'occurred_at',
])
@Index('IDX_activity_audits_subject_time', [
  'subject_type',
  'subject_id',
  'occurred_at',
])
@Index('IDX_activity_audits_resource_time', [
  'resource_type',
  'resource_id',
  'occurred_at',
])
@Index('IDX_activity_audits_domain_event_time', [
  'domain',
  'event',
  'occurred_at',
])
export class AuditEventEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 128 })
  public readonly event!: string;

  @Column({ type: 'varchar', length: 32 })
  public readonly outcome!: string;

  @Column({ type: 'varchar', length: 32 })
  public readonly actor_type!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  public readonly actor_id!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  public readonly subject_type!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  public readonly subject_id!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  public readonly resource_type!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  public readonly resource_id!: string | null;

  @Index('IDX_activity_audits_operation_id')
  @Column({ type: 'varchar', length: 128, nullable: true })
  public readonly operation_id!: string | null;

  @Index('IDX_activity_audits_idempotency_id')
  @Column({ type: 'varchar', length: 128, nullable: true })
  public readonly idempotency_id!: string | null;

  @Column({ type: 'varchar', length: 64 })
  public readonly domain!: string;

  @Index('IDX_activity_audits_request_id')
  @Column({ type: 'varchar', length: 64, nullable: true })
  public readonly request_id!: string | null;

  @Index('IDX_activity_audits_session_id')
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

  @Column({ type: 'json', nullable: true })
  public readonly error!: RedactedAuditData | null;
}
