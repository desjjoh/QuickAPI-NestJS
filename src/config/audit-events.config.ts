export enum AuditEventDomain {
  IDENTITY = 'identity',
}

export enum IdentityAuditEvents {
  REGISTRATION_REQUESTED = 'identity.registration.requested',
  REGISTRATION_VERIFICATION_SUCCEEDED = 'identity.registration.verification_succeeded',
  REGISTRATION_VERIFICATION_FAILED = 'identity.registration.verification_failed',
  REGISTRATION_VERIFICATION_RESENT = 'identity.registration.verification_resent',
  SIGN_IN_SUCCEEDED = 'identity.sign_in.succeeded',
  SIGN_IN_FAILED = 'identity.sign_in.failed',
  MFA_SIGN_IN_CHALLENGE_ISSUED = 'identity.mfa.sign_in.challenge_issued',
  MFA_SIGN_IN_VERIFICATION_SUCCEEDED = 'identity.mfa.sign_in.verification_succeeded',
  MFA_SIGN_IN_VERIFICATION_FAILED = 'identity.mfa.sign_in.verification_failed',
  SESSION_ISSUED = 'identity.session.issued',
  REFRESH_SUCCEEDED = 'identity.refresh.succeeded',
  REFRESH_FAILED = 'identity.refresh.failed',
  SIGN_OUT_COMPLETED = 'identity.sign_out.completed',
  PASSWORD_RESET_REQUESTED = 'identity.password_reset.requested',
  PASSWORD_RESET_CODE_ACCEPTED = 'identity.password_reset.code_accepted',
  PASSWORD_RESET_CODE_REJECTED = 'identity.password_reset.code_rejected',
  PASSWORD_RESET_COMPLETED = 'identity.password_reset.completed',
  PASSWORD_CHANGED = 'identity.password.changed',
  EMAIL_VERIFICATION_REQUESTED = 'identity.email_verification.requested',
  EMAIL_VERIFICATION_COMPLETED = 'identity.email_verification.completed',
  EMAIL_CHANGE_REQUESTED = 'identity.email_change.requested',
  EMAIL_CHANGE_COMPLETED = 'identity.email_change.completed',
  MFA_ENROLLMENT_REQUESTED = 'identity.mfa.enrollment_requested',
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
