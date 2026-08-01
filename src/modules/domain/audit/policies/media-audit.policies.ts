import { AuditPolicy, scalar } from '../types/audit-policy.types';
import { AuditResourceType } from '@/config/audit-events.config';

export const MEDIA_AUDIT_POLICIES: Readonly<Record<string, AuditPolicy>> = {
  [AuditResourceType.MEDIA_IMAGE]: {
    id: scalar,
    owner_id: scalar,
    filename: scalar,
    mime_type: scalar,
    width: scalar,
    height: scalar,
    created_at: scalar,
  },
};
