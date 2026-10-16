import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage<string>();

/** Only populated while an accepted keyed operation actually executes. */
export function withIdempotencyKey<T>(key: string, work: () => T): T {
  return storage.run(key, work);
}

export function activeIdempotencyKey(): string | null {
  return storage.getStore() ?? null;
}
