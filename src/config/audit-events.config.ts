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

  PROFILE_NAME_CHANGED = 'identity.profile.name_changed',
  PROFILE_PERSONAL_INFORMATION_CHANGED = 'identity.profile.personal_information_changed',
  PROFILE_COUNTRY_CHANGED = 'identity.profile.country_changed',
  PROFILE_TIMEZONE_CHANGED = 'identity.profile.timezone_changed',
  PROFILE_AVATAR_ASSIGNED = 'identity.profile.avatar_assigned',
  PROFILE_AVATAR_REPLACED = 'identity.profile.avatar_replaced',
  PROFILE_AVATAR_REMOVED = 'identity.profile.avatar_removed',
  PROFILE_PHONE_CREATED = 'identity.profile.phone_created',
  PROFILE_PHONE_UPDATED = 'identity.profile.phone_updated',
  PROFILE_PHONE_REMOVED = 'identity.profile.phone_removed',
  PROFILE_ADDRESS_CREATED = 'identity.profile.address_created',
  PROFILE_ADDRESS_UPDATED = 'identity.profile.address_updated',
  PROFILE_ADDRESS_REMOVED = 'identity.profile.address_removed',

  ADMIN_USER_UPDATED = 'identity.admin.user_updated',
  ADMIN_USER_DELETED = 'identity.admin.user_deleted',
}

export type AuditEventKey = IdentityAuditEvents;

export const AUDIT_EVENT_MATRIX = {
  [AuditEventDomain.IDENTITY]: IdentityAuditEvents,
};
