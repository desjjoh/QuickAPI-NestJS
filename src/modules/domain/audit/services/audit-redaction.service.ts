import { Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  AuditFieldPolicy as FieldPolicy,
  AuditPolicy as FieldTree,
  changedOnly,
  hashed,
  relationshipIds,
  scalar,
} from '../types/audit-policy.types';
import { AuditPolicyRegistry } from './audit-policy.registry';

export type AuditValue =
  | null
  | boolean
  | number
  | string
  | AuditValue[]
  | { [key: string]: AuditValue };

const METADATA_FIELDS: FieldTree = {
  request_id: scalar,
  correlation_id: scalar,
  operation_id: scalar,
  actor_role: scalar,
  actor_label: scalar,
  subject_label: scalar,
  reason: scalar,
  reason_code: scalar,
  client_application: scalar,
  job_name: scalar,
  route: scalar,
  method: scalar,
  status: scalar,
  status_code: scalar,
  session_ids: relationshipIds,
  ip: hashed,
  ip_address: hashed,
  user_agent: changedOnly,
};

const SECRET_KEY =
  /(?:password|passwd|refresh|token|secret|credential|api[_-]?key|private[_-]?key|signing[_-]?key|encryption[_-]?key|mfa|verification|reset|recovery|authorization|cookie|postmark|r2|csrf|code(?:[_-]?hash)?)/i;
const RAW_CONTAINER_KEY = /^(?:body|raw_body|request_body|exception|error)$/i;
const OMITTED = '[REDACTED]';
const CHANGED = '[CHANGED]';
const TRUNCATED = '[TRUNCATED]';
const CIRCULAR = '[CIRCULAR]';
const SAFE_ERROR_TYPE = /^(?:Error|[A-Za-z][A-Za-z0-9]*(?:Error|Exception))$/;

export interface AuditRedactionOptions {
  readonly maxDepth?: number;
  readonly maxArrayLength?: number;
  readonly maxStringLength?: number;
  readonly maxBytes?: number;
}

export interface AuditDiff {
  readonly before: AuditValue;
  readonly after: AuditValue;
  readonly changes: AuditValue;
}

@Injectable()
export class AuditRedactionService {
  private readonly limits: Required<AuditRedactionOptions>;

  public constructor(
    @Optional() options: AuditRedactionOptions = {},
    @Optional()
    private readonly registry: AuditPolicyRegistry = new AuditPolicyRegistry(),
  ) {
    this.limits = {
      maxDepth: options.maxDepth ?? 8,
      maxArrayLength: options.maxArrayLength ?? 50,
      maxStringLength: options.maxStringLength ?? 1024,
      maxBytes: options.maxBytes ?? 16_384,
    };
  }

  public hasPolicy(resourceType: string): boolean {
    return this.registry.has(resourceType);
  }

  public redactSnapshot(resourceType: string, entity: unknown): AuditValue {
    return this.fit(
      this.applyTree(entity, this.policy(resourceType), new WeakSet(), 0),
    );
  }

  public redactDiff(
    resourceType: string,
    before: unknown,
    after: unknown,
  ): AuditDiff {
    const safeBefore = this.redactSnapshot(resourceType, before);
    const safeAfter = this.redactSnapshot(resourceType, after);
    const diff = this.diffTree(
      this.asRecord(safeBefore),
      this.asRecord(safeAfter),
      this.policy(resourceType),
    );
    return {
      before: this.fit(diff.before),
      after: this.fit(diff.after),
      changes: this.fit(diff.changes),
    };
  }

  /** Metadata also uses a fixed allowlist; arbitrary keys are never retained. */
  public redactMetadata(metadata: unknown): AuditValue {
    return this.fit(
      this.applyTree(metadata, METADATA_FIELDS, new WeakSet(), 0),
    );
  }

  /** Never serializes an exception object, its stack, cause, or arbitrary fields. */
  public serializeError(error: unknown): AuditValue {
    if (!(error instanceof Error)) return { type: 'UnknownError' };
    const type = error.name || 'Error';

    return {
      type:
        SAFE_ERROR_TYPE.test(type) && !SECRET_KEY.test(type)
          ? this.safeString(type)
          : 'UnknownError',
      message: OMITTED,
    };
  }

  private policy(resourceType: string): FieldTree {
    const policy = this.registry.get(resourceType);
    if (!policy)
      throw new Error(
        `No audit redaction policy registered for ${resourceType}`,
      );
    return policy;
  }

  private applyTree(
    input: unknown,
    tree: FieldTree,
    seen: WeakSet<object>,
    depth: number,
  ): AuditValue {
    if (input === null || typeof input !== 'object') return {};
    if (seen.has(input)) return CIRCULAR;
    if (depth >= this.limits.maxDepth) return TRUNCATED;
    seen.add(input);

    const source = input as Record<string, unknown>;
    const result: Record<string, AuditValue> = {};
    for (const key of Object.keys(tree).sort()) {
      if (!(key in source)) continue;
      const policy = tree[key];
      // This guard is deliberately applied even to allowlisted future fields.
      if (SECRET_KEY.test(key) || RAW_CONTAINER_KEY.test(key)) {
        result[key] = policy.kind === 'changed-only' ? CHANGED : OMITTED;
      } else {
        result[key] = this.applyPolicy(source[key], policy, seen, depth + 1);
      }
    }
    seen.delete(input);
    return result;
  }

  private applyPolicy(
    value: unknown,
    policy: FieldPolicy,
    seen: WeakSet<object>,
    depth: number,
  ): AuditValue {
    if (policy.kind === 'changed-only') return CHANGED;
    if (policy.kind === 'masked')
      return policy.mask === 'email' ? this.maskEmail(value) : this.hash(value);
    if (policy.kind === 'scalar') return this.scalar(value);
    if (policy.kind === 'relationship-ids')
      return this.relationIds(value, policy.preserveOrder === true);
    return this.applyTree(value, policy.fields, seen, depth);
  }

  /**
   * Collection relations are deliberately reduced without traversing an item.
   * Policies may preserve relationship order when application order is
   * meaningful; ordinary relation sets are sorted for stable diffs.
   */
  private relationIds(value: unknown, preserveOrder: boolean): AuditValue[] {
    if (!Array.isArray(value)) return [];

    const ids: string[] = [];
    const unique = new Set<string>();
    for (const item of value) {
      const candidate =
        typeof item === 'string'
          ? item
          : item !== null && typeof item === 'object' && 'id' in item
            ? (item as { id?: unknown }).id
            : undefined;
      if (typeof candidate !== 'string' || candidate.trim().length === 0)
        continue;
      const id = this.safeString(candidate);
      if (!unique.has(id)) {
        unique.add(id);
        ids.push(id);
      }
    }

    if (!preserveOrder) ids.sort();
    if (ids.length <= this.limits.maxArrayLength) return ids;
    return [...ids.slice(0, this.limits.maxArrayLength), TRUNCATED];
  }

  private scalar(value: unknown): AuditValue {
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number')
      return Number.isFinite(value) ? value : String(value);
    if (typeof value === 'string') return this.safeString(value);
    if (value instanceof Date)
      return Number.isNaN(value.getTime())
        ? 'Invalid Date'
        : value.toISOString();
    // Raw bytes and relations/embedded objects require an explicit nested tree.
    if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return '[BINARY]';
    return '[OBJECT]';
  }

  private safeString(value: string): string {
    return value.length <= this.limits.maxStringLength
      ? value
      : `${value.slice(0, this.limits.maxStringLength)}${TRUNCATED}`;
  }

  private maskEmail(value: unknown): string {
    if (typeof value !== 'string') return CHANGED;
    const at = value.lastIndexOf('@');
    if (at < 1) return CHANGED;
    return `${value[0]}***@${value.slice(at + 1)}`;
  }

  private hash(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0) return CHANGED;
    return `sha256:${createHash('sha256').update(value).digest('hex')}`;
  }

  private fit(value: AuditValue): AuditValue {
    return Buffer.byteLength(JSON.stringify(value)) <= this.limits.maxBytes
      ? value
      : { truncated: TRUNCATED };
  }

  private diffTree(
    before: Record<string, AuditValue>,
    after: Record<string, AuditValue>,
    tree: FieldTree,
  ): {
    before: Record<string, AuditValue>;
    after: Record<string, AuditValue>;
    changes: Record<string, AuditValue>;
  } {
    const result = {
      before: {} as Record<string, AuditValue>,
      after: {} as Record<string, AuditValue>,
      changes: {} as Record<string, AuditValue>,
    };

    for (const field of Object.keys(tree).sort()) {
      const hasBefore = Object.prototype.hasOwnProperty.call(before, field);
      const hasAfter = Object.prototype.hasOwnProperty.call(after, field);
      const left = before[field];
      const right = after[field];
      const policy = tree[field];

      if (policy.kind === 'nested-object' && hasBefore && hasAfter) {
        const nested = this.diffTree(
          this.asRecord(left),
          this.asRecord(right),
          policy.fields,
        );
        if (Object.keys(nested.changes).length > 0) {
          result.before[field] = nested.before;
          result.after[field] = nested.after;
          result.changes[field] = nested.changes;
        }
        continue;
      }

      if (hasBefore === hasAfter && this.equal(left, right)) continue;

      if (hasBefore) result.before[field] = left;
      if (hasAfter) result.after[field] = right;
      if (policy.kind === 'relationship-ids') {
        const beforeIds = hasBefore && Array.isArray(left) ? left : [];
        const afterIds = hasAfter && Array.isArray(right) ? right : [];

        const beforeSet = new Set(
          beforeIds.filter((id) => id !== TRUNCATED).map(String),
        );

        const afterSet = new Set(
          afterIds.filter((id) => id !== TRUNCATED).map(String),
        );

        result.changes[field] = {
          before: beforeIds,
          after: afterIds,
          added_ids: afterIds.filter(
            (id) => id !== TRUNCATED && !beforeSet.has(String(id)),
          ),
          removed_ids: beforeIds.filter(
            (id) => id !== TRUNCATED && !afterSet.has(String(id)),
          ),
        };
      } else {
        result.changes[field] = {
          before: hasBefore ? left : null,
          after: hasAfter ? right : null,
        };
      }
    }
    return result;
  }

  private equal(left: AuditValue | undefined, right: AuditValue | undefined) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private asRecord(value: AuditValue): Record<string, AuditValue> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  }
}
