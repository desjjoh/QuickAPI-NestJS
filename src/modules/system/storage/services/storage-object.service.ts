import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { InvalidOperationError } from '@/common/errors/operation.error';
import { storageTrackingPolicy } from '@/config/storage-tracking.config';
import { StorageObjectEntity } from '../entities/storage-object.entity';
import { StorageObjectRepository } from '../repositories/storage-object.repository';

@Injectable()
export class StorageObjectService {
  public constructor(private readonly repository: StorageObjectRepository) {}

  public async reserve(
    folder: string,
    extension: string,
  ): Promise<{ storage_key: string; filename: string }> {
    if (
      !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(folder) ||
      !/^\.[a-z0-9]{1,10}$/.test(extension)
    )
      throw new InvalidOperationError('Invalid managed storage location.');
    const filename = `${randomUUID()}${extension}`;
    const key = `${folder}/${filename}`;

    if (key.length > 255)
      throw new InvalidOperationError('Managed storage key is too long.');
    const manager = await this.repository.reservationManager();

    // Deliberately do not join the request's application transaction.
    await manager.insert(StorageObjectEntity, {
      storage_key: key,
      state: 'reserved',
      created_at: new Date(),
      expires_at: new Date(
        Date.now() + storageTrackingPolicy.reservationGraceMs,
      ),
    });

    return { storage_key: key, filename };
  }

  public async upload(key: string, work: () => Promise<void>): Promise<void> {
    const manager = await this.repository.reservationManager();

    // Lock while PUT is active: reconciliation skips active uploads, even if a process pauses past its lease.
    await manager.transaction(async (transaction) => {
      const object = await this.repository.findLocked(transaction, key);

      if (object?.state !== 'reserved')
        throw new ConflictException(
          'Upload reservation is no longer available.',
        );
      await work();
      await transaction.update(
        StorageObjectEntity,
        { storage_key: key },
        {
          state: 'uploaded',
          expires_at: new Date(
            Date.now() + storageTrackingPolicy.reservationGraceMs,
          ),
        },
      );
    });
  }

  public async attach(manager: EntityManager, key: string): Promise<void> {
    this.assertTransaction(manager);
    const object = await this.repository.findLocked(manager, key);

    if (object?.state !== 'uploaded')
      throw new ConflictException(
        'Storage object cannot be attached. Upload it again.',
      );
    await manager.update(
      StorageObjectEntity,
      { storage_key: key },
      { state: 'attached', expires_at: null },
    );
  }

  public async abandon(key: string): Promise<void> {
    const manager = await this.repository.reservationManager();

    // A confirmed PUT can be reclaimed now. A reserved key may still receive
    // a late provider write, so uncertain outcomes retain the grace period.
    await manager.update(
      StorageObjectEntity,
      { storage_key: key, state: 'uploaded' },
      { expires_at: new Date() },
    );
    await manager.update(
      StorageObjectEntity,
      { storage_key: key, state: 'reserved' },
      {
        expires_at: new Date(
          Date.now() + storageTrackingPolicy.reservationGraceMs,
        ),
      },
    );
  }

  public async ensureTracked(
    manager: EntityManager,
    key: string,
  ): Promise<void> {
    this.assertTransaction(manager);
    // Existing images and pre-tracking intents are registered by the migration;
    // this also covers trusted legacy import paths without ever reviving a tombstone.
    await manager
      .createQueryBuilder()
      .insert()
      .into(StorageObjectEntity)
      .values({
        storage_key: key,
        state: 'attached',
        created_at: new Date(),
        expires_at: null,
      })
      .orIgnore()
      .execute();
  }

  public async lock(
    manager: EntityManager,
    key: string,
  ): Promise<StorageObjectEntity | null> {
    return this.repository.findLocked(manager, key);
  }

  public async markDeleting(
    manager: EntityManager,
    key: string,
  ): Promise<void> {
    await manager.update(
      StorageObjectEntity,
      { storage_key: key },
      { state: 'deleting', expires_at: null },
    );
  }

  public async markDeleted(manager: EntityManager, key: string): Promise<void> {
    await manager.update(
      StorageObjectEntity,
      { storage_key: key },
      {
        state: 'deleted',
        expires_at: new Date(
          Date.now() + storageTrackingPolicy.reservationGraceMs,
        ),
      },
    );
  }

  public async abandoned(
    manager: EntityManager,
  ): Promise<StorageObjectEntity[]> {
    return this.repository.findAbandoned(manager);
  }

  private assertTransaction(manager: EntityManager): void {
    if (!manager.queryRunner?.isTransactionActive)
      throw new InvalidOperationError(
        'Storage ownership changes require the originating transaction.',
      );
  }
}
