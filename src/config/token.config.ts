export enum AccountTokenType {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
  EMAIL_CHANGE = 'email_change',
  EMAIL_MFA = 'email_mfa',
}

export const MAX_VERIFICATION_CODE_ATTEMPTS = 5;
