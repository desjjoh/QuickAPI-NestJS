import type {
  AuditActorType,
  AuditResourceType,
  AuditSubjectType,
} from '@/config/audit-events.config';
import type { AuditSort } from '@/common/models/audit.model';
import type { Order } from '@/common/models/pagination.model';

/** The deliberately bounded set of columns on which audit events may be queried. */
export interface AuditQuery {
  readonly domain?: string;
  readonly event?: string;
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
  readonly sort?: AuditSort;
  readonly order?: Order;
  readonly page?: number;
  readonly take?: number;
}
