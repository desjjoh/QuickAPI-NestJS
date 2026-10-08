import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { imageSize } from 'image-size';
import { readFile } from 'node:fs/promises';
import { posix } from 'path';
import { ISizeCalculationResult } from 'image-size/types/interface';

import { Base } from '@/common/models/base.model';
import { useFileManager } from '@/common/handlers/file.handler';
import { omitUndefinedDeep } from '@/common/helpers/typing.helper';

import { ImageEntity } from '../entities/image.entity';
import { ImageRepository } from '../repositories/image.repository';
import { StorageService } from '@/modules/system/storage/types/storage.types';
import type { DeepPartial, EntityManager } from 'typeorm';

export type CreateImageInput = {
  file: Express.Multer.File;
  alt_text?: string | null;
  folder: string;
};

export type UpdateImageInput = {
  image: ImageEntity;
  file: Express.Multer.File;
  alt_text?: string | null;
  folder: string;
};

type StoredFileResult = {
  storage_key: string;
  filename: string;
};

const fileManager = useFileManager();

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
  ): Promise<ImageEntity> {
    this.validateImage(input.file);

    const buffer = await readFile(input.file.path);
    const metadata = this.extractMetadata(buffer);

    const storedFile = await this.storeFile(input.file, input.folder, buffer);

    try {
      const payload: Base<ImageEntity> = {
        storage_key: storedFile.storage_key,
        filename: storedFile.filename,
        size_bytes: input.file.size,
        width: metadata.width,
        height: metadata.height,
        mime_type: input.file.mimetype,
        alt_text: input.alt_text ?? null,
      };

      const image = manager.create(ImageEntity, payload);
      const created = await manager.save(ImageEntity, image);

      return await manager.findOneByOrFail(ImageEntity, { id: created.id });
    } catch (error) {
      await this.removeStoredFile(storedFile.storage_key);

      throw error;
    }
  }

  public async update(
    input: UpdateImageInput,
    manager: EntityManager = this.imgRepo.manager,
  ): Promise<ImageEntity> {
    this.validateImage(input.file);

    const previousStorageKey = input.image.storage_key;

    const buffer = await readFile(input.file.path);
    const metadata = this.extractMetadata(buffer);

    const storedFile = await this.storeFile(input.file, input.folder, buffer);

    try {
      const payload: Partial<Base<ImageEntity>> = {
        storage_key: storedFile.storage_key,
        filename: storedFile.filename,
        size_bytes: input.file.size,
        width: metadata.width,
        height: metadata.height,
        mime_type: input.file.mimetype,
        alt_text: input.alt_text,
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

      await this.removeStoredFile(previousStorageKey);

      return savedImage;
    } catch (error) {
      await this.removeStoredFile(storedFile.storage_key);

      throw error;
    }
  }

  public async remove(
    image: ImageEntity,
    manager: EntityManager = this.imgRepo.manager,
  ): Promise<ImageEntity> {
    await this.removeStoredFile(image.storage_key);
    await manager.delete(ImageEntity, { id: image.id });

    return image;
  }

  private validateImage(file: Express.Multer.File): void {
    if (!file) throw new BadRequestException('Image file is required.');

    if (!file.mimetype.startsWith('image/'))
      throw new BadRequestException('Uploaded file must be an image.');
  }

  private extractMetadata(buffer: Buffer): ISizeCalculationResult {
    return imageSize(buffer as unknown as Uint8Array);
  }

  private async storeFile(
    file: Express.Multer.File,
    folder: string,
    buffer: Buffer,
  ): Promise<StoredFileResult> {
    const storageKey = posix.join(folder, file.filename);

    try {
      await this.storageSvc.putObject({
        key: storageKey,
        body: buffer,
        contentType: file.mimetype,
        metadata: {
          filename: file.filename,
          originalName: file.originalname,
        },
      });

      return {
        storage_key: storageKey,
        filename: file.filename,
      };
    } finally {
      await fileManager.removeFile(file.path);
    }
  }

  private async removeStoredFile(storageKey: string): Promise<void> {
    await this.storageSvc.deleteObject({
      key: storageKey,
    });
  }
}
