import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { logger } from '@/config/logger.config';
import { StorageService } from '../types/storage.types';
import { StorageObjectService } from './storage-object.service';
import { storageTrackingPolicy } from '@/config/storage-tracking.config';
import type { EntityManager } from 'typeorm';
import { STORAGE_UPLOAD_FAILURE } from '../types/storage-upload.contract';

type UploadInput = {
  originalName: string;
  folder: string;
  buffer: Buffer;
  extension: string;
  mimeType: string;
};
@Injectable()
export class StorageUploadService {
  public constructor(
    private readonly storage: StorageService,
    private readonly objects: StorageObjectService,
  ) {}
  public async upload(
    input: UploadInput,
  ): Promise<{ storage_key: string; filename: string }> {
    const reserved = await this.objects.reserve(input.folder, input.extension);
    try {
      await this.objects.upload(reserved.storage_key, () =>
        this.storage
          .putObject({
            key: reserved.storage_key,
            body: input.buffer,
            contentType: input.mimeType,
            metadata: {
              filename: reserved.filename,
              originalName: input.originalName,
            },
            signal: AbortSignal.timeout(storageTrackingPolicy.uploadTimeoutMs),
          })
          .then(() => undefined)
          .catch(() => {
            throw new ServiceUnavailableException(STORAGE_UPLOAD_FAILURE);
          }),
      );
    } catch (error) {
      await this.abandon(reserved.storage_key);
      throw error;
    }
    return reserved;
  }
  public async attach(
    manager: EntityManager,
    storageKey: string,
  ): Promise<void> {
    await this.objects.attach(manager, storageKey);
  }
  /** Run after rollback has released ownership locks, never inside the failing transaction. */
  public async abandon(storageKey: string): Promise<void> {
    try {
      await this.objects.abandon(storageKey);
    } catch {
      // The independently committed reservation remains eligible after its grace period.
      logger.error(
        { storageKey },
        'Upload abandonment failed; reconciliation will recover the reservation.',
      );
    }
  }
}
