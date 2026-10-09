export const idempotencyPolicy = {
  retentionMs: 24 * 60 * 60 * 1000,
  sweepIntervalMs: 60 * 60 * 1000,
  maxKeyLength: 128,
} as const;
