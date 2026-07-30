export const IDENTITY_AUDIT_EVENTS = {
  REGISTRATION_REQUESTED: 'identity.registration.requested',
  REGISTRATION_VERIFICATION_SUCCEEDED:
    'identity.registration.verification_succeeded',
  REGISTRATION_VERIFICATION_FAILED: 'identity.registration.verification_failed',
  REGISTRATION_VERIFICATION_RESENT: 'identity.registration.verification_resent',
  SIGN_IN_SUCCEEDED: 'identity.sign_in.succeeded',
  SIGN_IN_FAILED: 'identity.sign_in.failed',
  MFA_SIGN_IN_CHALLENGE_ISSUED: 'identity.mfa.sign_in.challenge_issued',
  MFA_SIGN_IN_VERIFICATION_SUCCEEDED:
    'identity.mfa.sign_in.verification_succeeded',
  MFA_SIGN_IN_VERIFICATION_FAILED: 'identity.mfa.sign_in.verification_failed',
  SESSION_ISSUED: 'identity.session.issued',
  REFRESH_SUCCEEDED: 'identity.refresh.succeeded',
  REFRESH_FAILED: 'identity.refresh.failed',
  SIGN_OUT_COMPLETED: 'identity.sign_out.completed',
} as const;
