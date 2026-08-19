/** The bounded set of parties that may initiate an audited action. */
export const AuditActorType = {
  USER: 'user',
  ANONYMOUS: 'anonymous',
  SERVICE: 'service',
  ADMIN: 'admin',
  SYSTEM: 'system',
} as const;
export type AuditActorType =
  (typeof AuditActorType)[keyof typeof AuditActorType];

export enum AuditEventDomain {
  IDENTITY = 'identity',
}

/** Stable aggregate keys used for audit subjects and API filtering. */
export enum AuditSubjectType {
  USER = 'user',
}

/** Stable, collision-resistant keys for objects affected by audit events. */
export enum AuditResourceType {
  IDENTITY_USER = 'identity.user',
  IDENTITY_PROFILE = 'identity.profile',
  IDENTITY_PHONE = 'identity.phone',
  IDENTITY_ADDRESS = 'identity.address',
  IDENTITY_IMAGE = 'identity.image',
  IDENTITY_SESSION = 'identity.session',
  IDENTITY_ROLE = 'identity.role',
  IDENTITY_ACCOUNT_STATUS = 'identity.account_status',
  MEDIA_IMAGE = 'media.image',
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
