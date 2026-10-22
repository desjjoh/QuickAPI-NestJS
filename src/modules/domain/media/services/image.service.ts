import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { Base } from '@/common/models/base.model';
import { removeTemporaryUpload } from '@/common/helpers/upload-cleanup.helper';
import {
  readValidatedImage,
  readImageUpload,
  type ValidatedImage,
} from '../policies/image-upload.policy';
import { omitUndefinedDeep } from '@/common/helpers/typing.helper';
import {
  TransactionLifecycle,
  runInTransaction,
} from '@/common/helpers/transaction.helper';
import { InvalidOperationError } from '@/common/errors/operation.error';

import { ImageEntity } from '../entities/image.entity';
import { ImageRepository } from '../repositories/image.repository';
import { StorageCleanupService } from '@/modules/system/storage-cleanup/services/storage-cleanup.service';
import { StorageUploadService } from '@/modules/system/storage/services/storage-upload.service';
import type { DeepPartial, EntityManager } from 'typeorm';
import { ImageProcessingService } from '@/modules/system/image-processing/services/image-processing.service';
import {
  ImageProcessingError,
  type ImageProcessingOptions,
} from '@/modules/system/image-processing/types/image-processing.types';

export type CreateImageInput = {
  file: Express.Multer.File;
  alt_text?: string | null;
  decorative?: boolean;
  folder: string;
  processing?: ImageProcessingOptions;
  maxBytes?: number;
};

export type UpdateImageInput = CreateImageInput & {
  image: ImageEntity;
};

@Injectable()
export class ImageService {
  public constructor(
    private readonly imgRepo: ImageRepository,
    private readonly uploads: StorageUploadService,
    private readonly cleanup: StorageCleanupService,
    private readonly processor: ImageProcessingService,
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
    if (!lifecycle)
      return runInTransaction(manager, (manager, lifecycle) =>
        this.create(input, manager, lifecycle),
      );
    const metadata = await this.prepareImage(input, manager, lifecycle);
    const storedFile = await this.uploads.upload({
      originalName: input.file.originalname,
      folder: input.folder,
      ...metadata,
    });
    lifecycle.afterRollback(() => this.uploads.abandon(storedFile.storage_key));
    await this.uploads.attach(manager, storedFile.storage_key);
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
  }

  public async update(
    input: UpdateImageInput,
    manager: EntityManager = this.imgRepo.manager,
    lifecycle?: TransactionLifecycle,
  ): Promise<ImageEntity> {
    if (!lifecycle)
      return runInTransaction(manager, (manager, lifecycle) =>
        this.updateImage(input, manager, lifecycle),
      );
    return this.updateImage(input, manager, lifecycle);
  }

  private async updateImage(
    input: UpdateImageInput,
    manager: EntityManager,
    lifecycle: TransactionLifecycle,
  ): Promise<ImageEntity> {
    const previousStorageKey = input.image.storage_key;
    const metadata = await this.prepareImage(input, manager, lifecycle);
    const storedFile = await this.uploads.upload({
      originalName: input.file.originalname,
      folder: input.folder,
      ...metadata,
    });
    lifecycle.afterRollback(() => this.uploads.abandon(storedFile.storage_key));

    await this.uploads.attach(manager, storedFile.storage_key);
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
    const savedImage = await manager.save(ImageEntity, updatedImage);
    await this.cleanup.schedule(manager, previousStorageKey, 'image_replaced');

    return savedImage;
  }

  public async remove(
    image: ImageEntity,
    manager: EntityManager = this.imgRepo.manager,
    lifecycle?: TransactionLifecycle,
  ): Promise<ImageEntity> {
    if (!lifecycle)
      return runInTransaction(manager, (manager, lifecycle) =>
        this.remove(image, manager, lifecycle),
      );
    this.assertTransactionLifecycle(manager, lifecycle);
    await manager.delete(ImageEntity, { id: image.id });
    await this.cleanup.schedule(manager, image.storage_key, 'image_removed');

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
    input: CreateImageInput,
    manager: EntityManager,
    lifecycle?: TransactionLifecycle,
  ): Promise<ValidatedImage> {
    const { file, processing, maxBytes } = input;
    let image: ValidatedImage;

    try {
      this.assertTransactionLifecycle(manager, lifecycle);

      if (processing) {
        const upload = await readImageUpload(file, maxBytes);
        image = await this.processor.process(upload.buffer, processing);
      } else {
        image = await readValidatedImage(file, maxBytes);
      }
    } catch (error) {
      await removeTemporaryUpload(file).catch(() => undefined);

      if (error instanceof ImageProcessingError) {
        if (error.code === 'busy')
          throw new ServiceUnavailableException(
            'Image processing is temporarily busy. Please retry.',
          );

        throw new BadRequestException(error.message);
      }

      throw error;
    }
    await removeTemporaryUpload(file);
    return image;
  }
}
