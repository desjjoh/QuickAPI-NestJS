import { Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';

export type AuditValue =
  | null
  | boolean
  | number
  | string
  | AuditValue[]
  | { [key: string]: AuditValue };

export type AuditEntityType =
  | 'user'
  | 'profile'
  | 'session'
  | 'role'
  | 'account_status'
  | 'image';

type FieldPolicy = 'value' | 'masked-email' | 'hash' | 'changed' | FieldTree;
interface FieldTree {
  readonly [field: string]: FieldPolicy;
}

/**
 * Personal-data policy for the audit table:
 *
 * - email is masked (the domain and at most the first local-part character remain);
 * - IP addresses are stored only as a one-way SHA-256 hash;
 * - phone, address, date of birth, and user agent are only `"[CHANGED]"` markers.
 *
 * Entity snapshots are deny-by-default: adding an entity property does not make
 * it auditable. It must also be added to the appropriate tree below.
 */
const ENTITY_FIELDS: Readonly<Record<AuditEntityType, FieldTree>> = {
  user: {
    id: 'value',
    identity: { email: 'masked-email' },
    profile: { id: 'value', name: { first: 'value', last: 'value' } },
    roles: { id: 'value', name: 'value' },
    status: { id: 'value', name: 'value' },
    active: 'value',
    created_at: 'value',
    updated_at: 'value',
    deleted_at: 'value',
    metadata: { mfa_enabled: 'value' },
  },
  profile: {
    id: 'value',
    name: { first: 'value', last: 'value', preferred: 'value' },
    phone: 'changed',
    address: 'changed',
    date_of_birth: 'changed',
    created_at: 'value',
    updated_at: 'value',
  },
  session: {
    id: 'value',
    user_id: 'value',
    active: 'value',
    ip: 'hash',
    user_agent: 'changed',
    created_at: 'value',
    expires_at: 'value',
    revoked_at: 'value',
  },
  role: { id: 'value', name: 'value', active: 'value' },
  account_status: { id: 'value', name: 'value', active: 'value' },
  image: {
    id: 'value',
    owner_id: 'value',
    filename: 'value',
    mime_type: 'value',
    width: 'value',
    height: 'value',
    created_at: 'value',
  },
};

const METADATA_FIELDS: FieldTree = {
  request_id: 'value',
  correlation_id: 'value',
  operation_id: 'value',
  actor_role: 'value',
  actor_label: 'value',
  subject_label: 'value',
  reason: 'value',
  reason_code: 'value',
  client_application: 'value',
  job_name: 'value',
  route: 'value',
  method: 'value',
  status: 'value',
  status_code: 'value',
  ip: 'hash',
  ip_address: 'hash',
  user_agent: 'changed',
};

const SECRET_KEY =
  /(?:password|passwd|refresh|token|secret|credential|api[_-]?key|private[_-]?key|signing[_-]?key|encryption[_-]?key|mfa|verification|reset|recovery|authorization|cookie|postmark|r2|csrf|code(?:[_-]?hash)?)/i;
const RAW_CONTAINER_KEY = /^(?:body|raw_body|request_body|exception|error)$/i;
const OMITTED = '[REDACTED]';
const CHANGED = '[CHANGED]';
const TRUNCATED = '[TRUNCATED]';
const CIRCULAR = '[CIRCULAR]';

export interface AuditRedactionOptions {
  readonly maxDepth?: number;
  readonly maxArrayLength?: number;
  readonly maxStringLength?: number;
  readonly maxBytes?: number;
}

@Injectable()
export class AuditRedactionService {
  private readonly limits: Required<AuditRedactionOptions>;

  public constructor(@Optional() options: AuditRedactionOptions = {}) {
    this.limits = {
      maxDepth: options.maxDepth ?? 8,
      maxArrayLength: options.maxArrayLength ?? 50,
      maxStringLength: options.maxStringLength ?? 1024,
      maxBytes: options.maxBytes ?? 16_384,
    };
  }

  public redactSnapshot(
    entityType: AuditEntityType,
    entity: unknown,
  ): AuditValue {
    return this.fit(
      this.applyTree(entity, ENTITY_FIELDS[entityType], new WeakSet(), 0),
    );
  }

  public redactDiff(
    entityType: AuditEntityType,
    before: unknown,
    after: unknown,
  ): { before: AuditValue; after: AuditValue; changed_fields: string[] } {
    const safeBefore = this.redactSnapshot(entityType, before);
    const safeAfter = this.redactSnapshot(entityType, after);
    const left = this.asRecord(safeBefore);
    const right = this.asRecord(safeAfter);
    const changed = [...new Set([...Object.keys(left), ...Object.keys(right)])]
      .filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]))
      .sort();
    return { before: safeBefore, after: safeAfter, changed_fields: changed };
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
    return {
      type: this.safeString(error.name || 'Error'),
      message: OMITTED,
    };
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
        result[key] = OMITTED;
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
    if (policy === 'changed') return CHANGED;
    if (policy === 'masked-email') return this.maskEmail(value);
    if (policy === 'hash') return this.hash(value);
    if (policy === 'value') return this.scalar(value);
    if (Array.isArray(value)) {
      const selected = value.slice(0, this.limits.maxArrayLength);
      const output = selected.map((item) =>
        this.applyTree(item, policy, seen, depth),
      );
      if (value.length > selected.length) output.push(TRUNCATED);
      return output;
    }
    return this.applyTree(value, policy, seen, depth);
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

  private asRecord(value: AuditValue): Record<string, AuditValue> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  }
}
