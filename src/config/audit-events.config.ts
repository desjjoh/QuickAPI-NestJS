export enum AuditEventDomain {
  IDENTITY = 'identity',
}

export enum IdentityAuditEvents {
  REGISTRATION_VERIFICATION_SUCCEEDED = 'identity.registration.verification_succeeded',
  SIGN_IN_SUCCEEDED = 'identity.sign_in.succeeded',
  SIGN_OUT_COMPLETED = 'identity.sign_out.completed',
  PASSWORD_RESET_REQUESTED = 'identity.password_reset.requested',
  PASSWORD_RESET_COMPLETED = 'identity.password_reset.completed',
  PASSWORD_CHANGED = 'identity.password.changed',
  EMAIL_CHANGE_COMPLETED = 'identity.email_change.completed',
  MFA_ENABLED = 'identity.mfa.enabled',
  MFA_DISABLED = 'identity.mfa.disabled',
  SESSION_REVOKED = 'identity.session.revoked',
  ALL_SESSIONS_REVOKED = 'identity.session.all_revoked',
  ACCOUNT_DELETED = 'identity.account.deleted',
}

export type AuditEventKey = IdentityAuditEvents;

export const AUDIT_EVENT_MATRIX = {
  [AuditEventDomain.IDENTITY]: IdentityAuditEvents,
};
