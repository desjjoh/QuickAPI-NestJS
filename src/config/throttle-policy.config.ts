import { minute } from '@/common/constants/milliseconds.constants';

export const throttlePolicies = {
  system: { limit: 120, ttl: minute },
  publicRead: { limit: 120, ttl: minute },
  csrf: { limit: 10, ttl: minute },
  signIn: { limit: 5, ttl: minute },
  registration: { limit: 3, ttl: minute },
  resend: { limit: 2, ttl: minute },
  passwordReset: { limit: 3, ttl: minute },
  passwordResetConfirmation: { limit: 10, ttl: minute },
  otpConfirmation: { limit: 5, ttl: minute },
  tokenRefresh: { limit: 10, ttl: minute },
  signOut: { limit: 10, ttl: minute },
  accountSecurityMutation: { limit: 10, ttl: minute },
  profileMutation: { limit: 30, ttl: minute },
  fileUpload: { limit: 10, ttl: minute },
  sessionRead: { limit: 60, ttl: minute },
  sessionMutation: { limit: 20, ttl: minute },
  administrationRead: { limit: 60, ttl: minute },
  administrationMutation: { limit: 10, ttl: minute },
} as const;
