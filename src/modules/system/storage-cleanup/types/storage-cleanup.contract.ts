/** SQL owns the retry budget; Redis is a disposable delivery mechanism. */
export const storageCleanupPolicy = {
  attempts: 5,
  operationTimeoutMs: 5000,
  dispatchLeaseMs: 60000,
  retryDelayMs: 1000,
} as const;

export const STORAGE_CLEANUP_FAILURE = 'Storage object deletion failed.';
export const STORAGE_CLEANUP_WORKER_FAILURE =
  'Storage cleanup attempt failed; inspect the durable intent.';

/** Terminal deliveries are acknowledged without executing another provider call. */
export type StorageCleanupOutcome =
  | 'missing'
  | 'completed'
  | 'blocked'
  | 'failed';

export function isCleanupIntentId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)
  );
}
