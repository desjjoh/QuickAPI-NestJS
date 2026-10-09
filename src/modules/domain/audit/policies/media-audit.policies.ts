import { AuditPolicy, scalar } from '../types/audit-policy.types';
import { AuditResourceType } from '@/config/audit-events.config';

export const MEDIA_AUDIT_POLICIES: Readonly<Record<string, AuditPolicy>> = {
  [AuditResourceType.MEDIA_IMAGE]: {
    id: scalar,
    owner_id: scalar,
    filename: scalar,
    mime_type: scalar,
    size_bytes: scalar,
    width: scalar,
    height: scalar,
    alt_text: scalar,
    decorative: scalar,
    created_at: scalar,
    updated_at: scalar,
  },
};
