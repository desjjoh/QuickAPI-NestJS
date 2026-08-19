import { RequestContext } from '@/common/store/request-context.store';
import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { AuditEventEntity } from '../entities/audit-event.entity';
import { AuditRedactionService, AuditValue } from './audit-redaction.service';
import {
  AuditActorType,
  AuditResourceType,
  AuditSubjectType,
} from '@/config/audit-events.config';

export type AuditOutcome =
  | 'succeeded'
  | 'failed'
  | 'denied'
  | 'pending'
  | 'unknown';
export type AuditSource =
  | 'http'
  | 'queue'
  | 'scheduled_job'
  | 'seed'
  | 'service'
  | 'migration'
  | 'system';

export interface RecordAuditInput {
  /** Domain which owns and defines this event. */
  readonly domain: string;
  readonly event: string;
  readonly outcome: AuditOutcome;
  /** Party which initiated the action. The ID may be null for anonymous/system actors. */
  readonly actorType: AuditActorType;
  readonly actorId?: string | null;
  /** Aggregate owner or party affected by the action. */
  readonly subjectType?: AuditSubjectType | null;
  readonly subjectId?: string | null;
  /** Specific object affected by the action. */
  readonly resourceType?: AuditResourceType | null;
  readonly resourceId?: string | null;
  readonly source: AuditSource;
  readonly metadata: Record<string, unknown>;
  /** An associated exception; only its redacted classification is stored. */
  readonly error?: unknown;
  readonly requestId?: string | null;
  readonly sessionId?: string | null;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly httpMethod?: string | null;
  readonly route?: string | null;
  readonly failureReason?: string | null;
  readonly failureCode?: string | null;
  readonly occurredAt?: Date;
  /** Correlates retries or multiple audit events belonging to one operation. */
  readonly operationId?: string | null;
  readonly before?: unknown;
  readonly after?: unknown;
  /** Persist a semantic event even when its redacted snapshots have no changes. */
  readonly meaningfulWithoutChanges?: boolean;
}

const MACHINE_KEY_PATTERN = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)*$/;
const EVENT_PATTERN = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)+$/;
const OUTCOMES: readonly AuditOutcome[] = [
  'succeeded',
  'failed',
  'denied',
  'pending',
  'unknown',
];
const ACTOR_TYPES: readonly AuditActorType[] = Object.values(AuditActorType);
const SOURCES: readonly AuditSource[] = [
  'http',
  'queue',
  'scheduled_job',
  'seed',
  'service',
  'migration',
  'system',
];
const SUBJECT_TYPES: readonly AuditSubjectType[] =
  Object.values(AuditSubjectType);
const RESOURCE_TYPES: readonly AuditResourceType[] =
  Object.values(AuditResourceType);
const MAX_JSON_BYTES = 64 * 1024;

@Injectable()
export class AuditService {
  public constructor(
    @InjectRepository(AuditEventEntity)
    private readonly repository: Repository<AuditEventEntity>,
    private readonly redaction: AuditRedactionService,
    private readonly requestContext: RequestContext,
  ) {}

  public record(
    input: RecordAuditInput,
    manager?: EntityManager,
  ): Promise<AuditEventEntity | null> {
    this.validateBase(input);
    const hasBefore = Object.prototype.hasOwnProperty.call(input, 'before');
    const hasAfter = Object.prototype.hasOwnProperty.call(input, 'after');
    if (hasBefore !== hasAfter)
      throw new BadRequestException(
        'before and after must be supplied together',
      );

    if (!hasBefore) {
      return this.persist(
        input,
        { before: null, after: null, changes: null },
        manager,
      );
    }

    this.requiredString('resourceType', input.resourceType, 64);
    if (!this.redaction.hasPolicy(input.resourceType as string))
      throw new BadRequestException(
        'resourceType has no registered snapshot policy',
      );

    this.requiredString('resourceId', input.resourceId, 255);
    const diff = this.redaction.redactDiff(
      input.resourceType as string,
      input.before,
      input.after,
    );
    const left = this.asRecord(diff.before);
    const right = this.asRecord(diff.after);
    const changes = this.asRecord(diff.changes);
    if (
      Object.keys(changes).length === 0 &&
      input.meaningfulWithoutChanges !== true
    )
      return Promise.resolve(null);

    return this.persist(
      input,
      {
        before: left,
        after: right,
        changes,
      },
      manager,
    );
  }

  private async persist(
    input: RecordAuditInput,
    data: Pick<AuditEventEntity, 'before' | 'after' | 'changes'>,
    manager?: EntityManager,
  ): Promise<AuditEventEntity> {
    const context = this.requestContext.getStore();
    const metadata = this.asRecord(
      this.redaction.redactMetadata(input.metadata),
    );

    const error = Object.prototype.hasOwnProperty.call(input, 'error')
      ? this.asRecord(this.redaction.serializeError(input.error))
      : null;

    this.enforcePayloadBounds(
      data.before,
      data.after,
      data.changes,
      metadata,
      error,
    );

    const repository = manager
      ? manager.getRepository(AuditEventEntity)
      : this.repository;
    const entity = repository.create({
      ...data,
      event: input.event,
      outcome: input.outcome,
      actor_type: input.actorType ?? context?.actorType,
      actor_id: this.explicitOrContext(input, 'actorId', context?.actorId),
      subject_type: input.subjectType ?? null,
      subject_id: input.subjectId ?? null,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      domain: input.domain,
      operation_id: input.operationId ?? null,
      request_id: this.explicitOrContext(
        input,
        'requestId',
        context?.requestId,
      ),
      session_id: this.explicitOrContext(
        input,
        'sessionId',
        context?.sessionId,
      ),
      ip_address: this.explicitOrContext(
        input,
        'ipAddress',
        context?.ipAddress,
      ),
      user_agent: this.explicitOrContext(
        input,
        'userAgent',
        context?.userAgent,
      ),
      http_method: this.explicitOrContext(
        input,
        'httpMethod',
        context?.method,
      )?.toUpperCase(),
      route: this.explicitOrContext(input, 'route', context?.normalizedRoute),
      failure_reason: input.failureReason ?? null,
      failure_code: input.failureCode ?? null,
      source: input.source ?? context?.source,
      occurred_at: input.occurredAt ?? new Date(),
      metadata,
      error,
    });

    await repository.insert(entity as never);

    return entity;
  }

  /** Explicit audit values, including null, take precedence over ambient context. */
  private explicitOrContext<K extends keyof RecordAuditInput>(
    input: RecordAuditInput,
    key: K,
    contextValue: string | undefined,
  ): string | null {
    const value = input[key] as string | null | undefined;
    return Object.prototype.hasOwnProperty.call(input, key) &&
      value !== undefined
      ? value
      : (contextValue ?? null);
  }

  private validateBase(input: RecordAuditInput): void {
    if (!input || typeof input !== 'object')
      throw new BadRequestException('audit input is required');

    this.requiredString('event', input.event, 128);
    this.requiredString('domain', input.domain, 64);

    if (!MACHINE_KEY_PATTERN.test(input.domain))
      throw new BadRequestException('domain must be a stable machine key');
    if (!EVENT_PATTERN.test(input.event))
      throw new BadRequestException('event must be a stable machine key');
    if (!input.event.startsWith(`${input.domain}.`))
      throw new BadRequestException(
        'event must begin with the declared domain namespace',
      );
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

    this.optionalString('actorId', input.actorId, 255);
    this.optionalString('subjectType', input.subjectType, 64);

    if (input.subjectType != null && !SUBJECT_TYPES.includes(input.subjectType))
      throw new BadRequestException('subjectType is invalid');

    this.optionalString('subjectId', input.subjectId, 255);
    this.optionalString('resourceType', input.resourceType, 64);

    if (
      input.resourceType != null &&
      !RESOURCE_TYPES.includes(input.resourceType)
    )
      throw new BadRequestException('resourceType is invalid');

    this.optionalString('resourceId', input.resourceId, 255);
    this.optionalString('requestId', input.requestId, 64);
    this.optionalString('sessionId', input.sessionId, 16);
    this.optionalString('ipAddress', input.ipAddress, 45);
    this.optionalString('userAgent', input.userAgent, 512);
    this.optionalString('httpMethod', input.httpMethod, 16);
    this.optionalString('route', input.route, 512);
    this.optionalString('failureReason', input.failureReason, 512);
    this.optionalString('failureCode', input.failureCode, 64);
    this.optionalString('operationId', input.operationId, 128);

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
}
