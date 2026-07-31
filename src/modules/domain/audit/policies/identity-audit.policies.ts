import {
  AuditPolicy,
  changedOnly,
  hashed,
  maskedEmail,
  nestedObject,
  relationshipIds,
  scalar,
} from '../types/audit-policy.types';

export const IDENTITY_AUDIT_POLICIES: Readonly<Record<string, AuditPolicy>> = {
  'identity.user': {
    id: scalar,
    identity: nestedObject({ email: maskedEmail, password: changedOnly }),
    profile: nestedObject({
      id: scalar,
      name: nestedObject({ first: scalar, last: scalar }),
    }),
    roles: relationshipIds,
    status: nestedObject({ id: scalar, name: scalar }),
    active: scalar,
    created_at: scalar,
    updated_at: scalar,
    deleted_at: scalar,
    metadata: nestedObject({ mfa_enabled: changedOnly }),
  },
  'identity.profile': {
    id: scalar,
    name: nestedObject({ first: scalar, last: scalar, preferred: scalar }),
    phone: changedOnly,
    address: changedOnly,
    date_of_birth: changedOnly,
    created_at: scalar,
    updated_at: scalar,
  },
  'identity.session': {
    id: scalar,
    user_id: scalar,
    active: scalar,
    ip: hashed,
    user_agent: changedOnly,
    created_at: scalar,
    expires_at: scalar,
    revoked_at: scalar,
  },
  'identity.role': { id: scalar, name: scalar, active: scalar },
  'identity.account_status': { id: scalar, name: scalar, active: scalar },
};
