import { AuditPolicy, scalar } from '../types/audit-policy.types';

export const MEDIA_AUDIT_POLICIES: Readonly<Record<string, AuditPolicy>> = {
  'media.image': {
    id: scalar,
    owner_id: scalar,
    filename: scalar,
    mime_type: scalar,
    width: scalar,
    height: scalar,
    created_at: scalar,
  },
};
