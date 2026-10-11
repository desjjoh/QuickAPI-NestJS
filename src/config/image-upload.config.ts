import { megabyte } from '@/common/constants/bytes.constants';

export const imageUploadPolicy = {
  // Includes multipart validation, the 60-second PUT deadline, and SQL work.
  requestTimeoutMs: 90_000,
  maxBytes: 10 * megabyte,
  avatarMaxBytes: megabyte,
  heroMaxBytes: 5 * megabyte,
  maxWidth: 8192,
  maxHeight: 8192,
  maxPixels: 40_000_000,
  staleAfterMs: 24 * 60 * 60 * 1000,
  sweepIntervalMs: 60 * 60 * 1000,
} as const;
