import type { EntityManager } from 'typeorm';

/** Consumers supply reference lookups; infrastructure never imports domain repositories. */
export abstract class StorageReferenceReader {
  public abstract findByStorageKey(
    manager: EntityManager,
    key: string,
  ): Promise<unknown | null>;
}
