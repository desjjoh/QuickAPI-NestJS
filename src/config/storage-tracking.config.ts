export const storageTrackingPolicy = {
  uploadTimeoutMs: 60_000,
  reservationGraceMs: 15 * 60_000,
  batchSize: 20,
  reservationConnections: 2,
} as const;
