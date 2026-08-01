import type { AuditOutcome } from '../services/audit.service';

/** The deliberately bounded set of columns on which audit events may be queried. */
export interface AuditQuery {
  readonly domain?: string;
  readonly event?: string;
  readonly outcome?: AuditOutcome;
  readonly actorType?: string;
  readonly actorId?: string | null;
  readonly subjectType?: string;
  readonly subjectId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly requestId?: string;
  readonly sessionId?: string;
  readonly occurredFrom?: Date;
  readonly occurredTo?: Date;
  readonly page?: number;
  readonly take?: number;
}
