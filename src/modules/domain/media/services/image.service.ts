import { Injectable, NotFoundException } from '@nestjs/common';

import { posix, parse } from 'path';

import { Base } from '@/common/models/base.model';
import { removeTemporaryUpload } from '@/common/helpers/upload-cleanup.helper';
import {
  readValidatedImage,
  type ValidatedImage,
} from '../policies/image-upload.policy';
import { omitUndefinedDeep } from '@/common/helpers/typing.helper';
import { TransactionLifecycle } from '@/common/helpers/transaction.helper';
import { InvalidOperationError } from '@/common/errors/operation.error';
import { logger } from '@/config/logger.config';

import { ImageEntity } from '../entities/image.entity';
import { ImageRepository } from '../repositories/image.repository';
import { StorageService } from '@/modules/system/storage/types/storage.types';
import type { DeepPartial, EntityManager } from 'typeorm';

export type CreateImageInput = {
  file: Express.Multer.File;
  alt_text?: string | null;
  decorative?: boolean;
  folder: string;
};

export type UpdateImageInput = {
  image: ImageEntity;
  file: Express.Multer.File;
  alt_text?: string | null;
  decorative?: boolean;
  folder: string;
};

type StoredFileResult = {
  storage_key: string;
  filename: string;
};

const storageDeleteAttempts = 3;

@Injectable()
export class ImageService {
  public constructor(
    private readonly imgRepo: ImageRepository,
    private readonly storageSvc: StorageService,
  ) {}

  public async findById(
    id: string,
    manager: EntityManager = this.imgRepo.manager,
  ): Promise<ImageEntity> {
    const image = await this.imgRepo.findById(manager, id);

    if (!image)
      throw new NotFoundException(`Image with ID "${id}" was not found.`);

    return image;
  }

  public async create(
    input: CreateImageInput,
    manager: EntityManager = this.imgRepo.manager,
    lifecycle?: TransactionLifecycle,
  ): Promise<ImageEntity> {
    const metadata = await this.prepareImage(input.file, manager, lifecycle);
    const storedFile = await this.storeFile(input.file, input.folder, metadata);
    const cancelRollback = lifecycle?.afterRollback(() =>
      this.removeStoredFile(storedFile.storage_key),
    );

    try {
      const payload: Base<ImageEntity> = {
        storage_key: storedFile.storage_key,
        filename: storedFile.filename,
        size_bytes: metadata.buffer.length,
        width: metadata.width,
        height: metadata.height,
        mime_type: metadata.mimeType,
        alt_text: input.alt_text ?? null,
        decorative: input.decorative ?? false,
      };

      const image = manager.create(ImageEntity, payload);
      const created = await manager.save(ImageEntity, image);

      return await manager.findOneByOrFail(ImageEntity, { id: created.id });
    } catch (error) {
      await this.compensateUpload(storedFile.storage_key, error);
      cancelRollback?.();

      throw error;
    }
  }

  public async update(
    input: UpdateImageInput,
    manager: EntityManager = this.imgRepo.manager,
    lifecycle?: TransactionLifecycle,
  ): Promise<ImageEntity> {
    const previousStorageKey = input.image.storage_key;
    const metadata = await this.prepareImage(input.file, manager, lifecycle);
    const storedFile = await this.storeFile(input.file, input.folder, metadata);
    const cancelRollback = lifecycle?.afterRollback(() =>
      this.removeStoredFile(storedFile.storage_key),
    );

    let savedImage: ImageEntity;
    try {
      const payload: Partial<Base<ImageEntity>> = {
        storage_key: storedFile.storage_key,
        filename: storedFile.filename,
        size_bytes: metadata.buffer.length,
        width: metadata.width,
        height: metadata.height,
        mime_type: metadata.mimeType,
        alt_text: input.alt_text,
        decorative: input.decorative,
      };

      const detachedImage = manager.create(
        ImageEntity,
        input.image as DeepPartial<ImageEntity>,
      );
      const updatedImage = manager.merge(
        ImageEntity,
        detachedImage,
        omitUndefinedDeep(payload),
      );
      savedImage = await manager.save(ImageEntity, updatedImage);
    } catch (error) {
      await this.compensateUpload(storedFile.storage_key, error);
      cancelRollback?.();

      throw error;
    }

    if (lifecycle)
      lifecycle.afterCommit(() => this.removeStoredFile(previousStorageKey));
    else await this.removeStoredFile(previousStorageKey);

    return savedImage;
  }

  public async remove(
    image: ImageEntity,
    manager: EntityManager = this.imgRepo.manager,
    lifecycle?: TransactionLifecycle,
  ): Promise<ImageEntity> {
    this.assertTransactionLifecycle(manager, lifecycle);
    await manager.delete(ImageEntity, { id: image.id });

    if (lifecycle)
      lifecycle.afterCommit(() => this.removeStoredFile(image.storage_key));
    else await this.removeStoredFile(image.storage_key);

    return image;
  }

  private assertTransactionLifecycle(
    manager: EntityManager,
    lifecycle?: TransactionLifecycle,
  ): void {
    if (manager.queryRunner?.isTransactionActive && !lifecycle)
      throw new InvalidOperationError(
        'Image mutations in an active database transaction require a transaction lifecycle.',
      );
  }

  private async prepareImage(
    file: Express.Multer.File,
    manager: EntityManager,
    lifecycle?: TransactionLifecycle,
  ): Promise<ValidatedImage> {
    let image: ValidatedImage;
    try {
      this.assertTransactionLifecycle(manager, lifecycle);
      image = await readValidatedImage(file);
    } catch (error) {
      await removeTemporaryUpload(file).catch(() => undefined);
      throw error;
    }
    await removeTemporaryUpload(file);
    return image;
  }

  private async storeFile(
    file: Express.Multer.File,
    folder: string,
    image: ValidatedImage,
  ): Promise<StoredFileResult> {
    const filename = `${parse(file.filename).name}${image.extension}`;
    const storageKey = posix.join(folder, filename);
    await this.storageSvc.putObject({
      key: storageKey,
      body: image.buffer,
      contentType: image.mimeType,
      metadata: {
        filename,
        originalName: file.originalname,
      },
    });

    return {
      storage_key: storageKey,
      filename,
    };
  }

  private async removeStoredFile(storageKey: string): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= storageDeleteAttempts; attempt += 1) {
      try {
        await this.storageSvc.deleteObject({ key: storageKey });
        return;
      } catch (error) {
        lastError = error;
      }
    }

    logger.error(
      { error: lastError, storageKey, attempts: storageDeleteAttempts },
      `Storage cleanup failed after ${storageDeleteAttempts} attempts for ${storageKey}.`,
    );
    throw lastError;
  }

  private async compensateUpload(
    storageKey: string,
    originalError: unknown,
  ): Promise<void> {
    try {
      await this.removeStoredFile(storageKey);
    } catch (cleanupError) {
      throw new AggregateError(
        [originalError, cleanupError],
        'Image persistence failed and the uploaded object could not be removed.',
        { cause: originalError },
      );
    }
  }
}
