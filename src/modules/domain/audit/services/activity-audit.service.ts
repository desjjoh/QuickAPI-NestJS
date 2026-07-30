import { RequestContext } from '@/common/store/request-context.store';
import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { ActivityAuditEntity } from '../entities/activity-audit.entity';
import {
  AuditEntityType,
  AuditRedactionService,
  AuditValue,
} from './audit-redaction.service';

export type AuditOutcome =
  | 'succeeded'
  | 'failed'
  | 'denied'
  | 'pending'
  | 'unknown';
export type AuditActorType =
  | 'user'
  | 'anonymous'
  | 'service'
  | 'admin'
  | 'system';
export type AuditSource =
  | 'http'
  | 'queue'
  | 'scheduled_job'
  | 'seed'
  | 'migration'
  | 'system';

interface AuditInputBase {
  readonly event: string;
  readonly outcome: AuditOutcome;
  readonly actorType: AuditActorType;
  readonly actorUserId?: string | null;
  readonly subjectUserId?: string | null;
  readonly entityType?: AuditEntityType | null;
  readonly entityId?: string | null;
  readonly source: AuditSource;
  readonly metadata: Record<string, unknown>;
  readonly requestId?: string | null;
  readonly sessionId?: string | null;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly httpMethod?: string | null;
  readonly route?: string | null;
  readonly failureReason?: string | null;
  readonly failureCode?: string | null;
  readonly occurredAt?: Date;
}

export type RecordActivityInput = AuditInputBase;

export interface RecordEntityChangeInput extends AuditInputBase {
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly before: unknown;
  readonly after: unknown;
}

const EVENT_PATTERN = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)+$/;
const OUTCOMES: readonly AuditOutcome[] = [
  'succeeded',
  'failed',
  'denied',
  'pending',
  'unknown',
];
const ACTOR_TYPES: readonly AuditActorType[] = [
  'user',
  'anonymous',
  'service',
  'admin',
  'system',
];
const SOURCES: readonly AuditSource[] = [
  'http',
  'queue',
  'scheduled_job',
  'seed',
  'migration',
  'system',
];
const ENTITY_TYPES: readonly AuditEntityType[] = [
  'user',
  'profile',
  'session',
  'role',
  'account_status',
  'image',
];
const MAX_JSON_BYTES = 64 * 1024;

@Injectable()
export class ActivityAuditService {
  public constructor(
    @InjectRepository(ActivityAuditEntity)
    private readonly repository: Repository<ActivityAuditEntity>,
    private readonly redaction: AuditRedactionService,
    private readonly requestContext: RequestContext,
  ) {}

  public recordActivity(
    input: RecordActivityInput,
    manager?: EntityManager,
  ): Promise<ActivityAuditEntity> {
    this.validateBase(input);
    return this.persist(
      input,
      {
        category: 'activity_event',
        before: null,
        after: null,
        changes: null,
      },
      manager,
    );
  }

  public recordEntityChange(
    input: RecordEntityChangeInput,
    manager?: EntityManager,
  ): Promise<ActivityAuditEntity> {
    this.validateBase(input);
    this.requiredString('entityType', input.entityType, 64);
    if (!ENTITY_TYPES.includes(input.entityType))
      throw new BadRequestException('entityType is invalid');
    this.requiredString('entityId', input.entityId, 64);
    if (!Object.prototype.hasOwnProperty.call(input, 'before'))
      throw new BadRequestException('before is required');
    if (!Object.prototype.hasOwnProperty.call(input, 'after'))
      throw new BadRequestException('after is required');

    const diff = this.redaction.redactDiff(
      input.entityType,
      input.before,
      input.after,
    );
    const left = this.asRecord(diff.before);
    const right = this.asRecord(diff.after);
    const changes = Object.fromEntries(
      diff.changed_fields.map((field) => [
        field,
        { before: left[field] ?? null, after: right[field] ?? null },
      ]),
    );

    return this.persist(
      input,
      {
        category: 'entity_change',
        before: left,
        after: right,
        changes,
      },
      manager,
    );
  }

  private async persist(
    input: AuditInputBase,
    data: Pick<
      ActivityAuditEntity,
      'category' | 'before' | 'after' | 'changes'
    >,
    manager?: EntityManager,
  ): Promise<ActivityAuditEntity> {
    const context = this.requestContext.getStore();
    const request = context?.request;
    const requestUser = request?.user as
      | { sessionEntity?: { id?: unknown }; sessionId?: unknown }
      | undefined;
    const metadata = this.asRecord(
      this.redaction.redactMetadata(input.metadata),
    );
    this.enforcePayloadBounds(data.before, data.after, data.changes, metadata);

    const repository = manager
      ? manager.getRepository(ActivityAuditEntity)
      : this.repository;
    const entity = repository.create({
      ...data,
      event: input.event,
      outcome: input.outcome,
      actor_type: input.actorType,
      actor_user_id: input.actorUserId ?? context?.userId ?? null,
      subject_user_id: input.subjectUserId ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      request_id: input.requestId ?? context?.requestId ?? null,
      session_id:
        input.sessionId ??
        this.stringValue(requestUser?.sessionEntity?.id) ??
        this.stringValue(requestUser?.sessionId) ??
        null,
      ip_address: input.ipAddress ?? context?.ip ?? null,
      user_agent:
        input.userAgent ?? this.headerValue(request?.headers?.['user-agent']),
      http_method: (input.httpMethod ?? context?.method ?? null)?.toUpperCase(),
      route: input.route ?? context?.path ?? null,
      failure_reason: input.failureReason ?? null,
      failure_code: input.failureCode ?? null,
      source: input.source,
      occurred_at: input.occurredAt ?? new Date(),
      metadata,
    });

    await repository.insert(entity as never);

    return entity;
  }

  private validateBase(input: AuditInputBase): void {
    if (!input || typeof input !== 'object')
      throw new BadRequestException('audit input is required');
    this.requiredString('event', input.event, 128);
    if (!EVENT_PATTERN.test(input.event))
      throw new BadRequestException('event must be a stable machine key');
    if (!OUTCOMES.includes(input.outcome))
      throw new BadRequestException('outcome is invalid');
    if (!ACTOR_TYPES.includes(input.actorType))
      throw new BadRequestException('actorType is invalid');
    if (!SOURCES.includes(input.source))
      throw new BadRequestException('source is invalid');
    if (!Object.prototype.hasOwnProperty.call(input, 'metadata'))
      throw new BadRequestException('metadata is required');
    if (
      input.metadata === null ||
      typeof input.metadata !== 'object' ||
      Array.isArray(input.metadata)
    )
      throw new BadRequestException('metadata must be an object');

    this.optionalString('actorUserId', input.actorUserId, 16);
    this.optionalString('subjectUserId', input.subjectUserId, 16);
    this.optionalString('entityId', input.entityId, 64);
    this.optionalString('requestId', input.requestId, 64);
    this.optionalString('sessionId', input.sessionId, 16);
    this.optionalString('ipAddress', input.ipAddress, 45);
    this.optionalString('userAgent', input.userAgent, 512);
    this.optionalString('httpMethod', input.httpMethod, 16);
    this.optionalString('route', input.route, 512);
    this.optionalString('failureReason', input.failureReason, 512);
    this.optionalString('failureCode', input.failureCode, 64);
    if (
      input.occurredAt !== undefined &&
      (!(input.occurredAt instanceof Date) ||
        Number.isNaN(input.occurredAt.getTime()))
    )
      throw new BadRequestException('occurredAt must be a valid Date');
  }

  private requiredString(name: string, value: unknown, max: number): void {
    if (typeof value !== 'string' || value.trim().length === 0)
      throw new BadRequestException(`${name} is required`);
    if (value.length > max)
      throw new BadRequestException(`${name} exceeds ${max} characters`);
  }

  private optionalString(name: string, value: unknown, max: number): void {
    if (value === undefined || value === null) return;
    this.requiredString(name, value, max);
  }

  private enforcePayloadBounds(...values: unknown[]): void {
    if (Buffer.byteLength(JSON.stringify(values)) > MAX_JSON_BYTES)
      throw new PayloadTooLargeException('audit payload exceeds 65536 bytes');
  }

  private asRecord(value: AuditValue): Record<string, AuditValue> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  }

  private stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private headerValue(value: string | string[] | undefined): string | null {
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  }
}
