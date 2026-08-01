import { BaseModel } from '@/common/models/base.model';
import { AuditEventEntity } from '../entities/audit-event.entity';

type AuditData = Readonly<Record<string, unknown>>;

function immutableData(
  value: Record<string, unknown> | null,
): AuditData | null {
  if (value === null) return null;

  return deepFreeze(structuredClone(value)) as AuditData;
}

function deepFreeze(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }

  return value;
}

/** A persistence-independent, immutable representation of an audit event. */
export class AuditEvent extends BaseModel {
  public readonly domain: string;
  public readonly event: string;
  public readonly outcome: string;
  public readonly actorType: string;
  public readonly actorId: string | null;
  public readonly subjectType: string | null;
  public readonly subjectId: string | null;
  public readonly resourceType: string | null;
  public readonly resourceId: string | null;
  public readonly operationId: string | null;
  public readonly idempotencyId: string | null;
  public readonly requestId: string | null;
  public readonly sessionId: string | null;
  public readonly ipAddress: string | null;
  public readonly userAgent: string | null;
  public readonly httpMethod: string | null;
  public readonly route: string | null;
  public readonly failureReason: string | null;
  public readonly failureCode: string | null;
  public readonly source: string;
  public readonly occurredAt: Date;
  public readonly before: AuditData | null;
  public readonly after: AuditData | null;
  public readonly changes: AuditData | null;
  public readonly metadata: AuditData | null;
  public readonly error: AuditData | null;

  public constructor(entity: AuditEventEntity) {
    super(entity);

    this.domain = entity.domain;
    this.event = entity.event;
    this.outcome = entity.outcome;
    this.actorType = entity.actor_type;
    this.actorId = entity.actor_id;
    this.subjectType = entity.subject_type;
    this.subjectId = entity.subject_id;
    this.resourceType = entity.resource_type;
    this.resourceId = entity.resource_id;
    this.operationId = entity.operation_id;
    this.idempotencyId = entity.idempotency_id;
    this.requestId = entity.request_id;
    this.sessionId = entity.session_id;
    this.ipAddress = entity.ip_address;
    this.userAgent = entity.user_agent;
    this.httpMethod = entity.http_method;
    this.route = entity.route;
    this.failureReason = entity.failure_reason;
    this.failureCode = entity.failure_code;
    this.source = entity.source;
    this.occurredAt = new Date(entity.occurred_at);
    this.before = immutableData(entity.before);
    this.after = immutableData(entity.after);
    this.changes = immutableData(entity.changes);
    this.metadata = immutableData(entity.metadata);
    this.error = immutableData(entity.error);
    Object.freeze(this.createdAt);
    Object.freeze(this.updatedAt);
    Object.freeze(this.occurredAt);
    Object.freeze(this);
  }
}

export class AuditQueryResult {
  public readonly events: readonly AuditEvent[];
  public readonly total: number;
  public readonly limit: number;
  public readonly offset: number;

  public constructor(
    events: readonly AuditEvent[],
    total: number,
    limit: number,
    offset: number,
  ) {
    this.events = Object.freeze([...events]);
    this.total = total;
    this.limit = limit;
    this.offset = offset;
    Object.freeze(this);
  }
}
