import type { AuditOutcome } from '../services/audit.service';
import type {
  AuditActorType,
  AuditResourceType,
  AuditSubjectType,
} from '@/config/audit-events.config';

/** The deliberately bounded set of columns on which audit events may be queried. */
export interface AuditQuery {
  readonly domain?: string;
  readonly event?: string;
  readonly outcome?: AuditOutcome;
  readonly actorType?: AuditActorType;
  readonly actorId?: string | null;
  readonly subjectType?: AuditSubjectType;
  readonly subjectId?: string;
  readonly resourceType?: AuditResourceType;
  readonly resourceId?: string;
  readonly requestId?: string;
  readonly sessionId?: string;
  readonly occurredFrom?: Date;
  readonly occurredTo?: Date;
  readonly page?: number;
  readonly take?: number;
}
