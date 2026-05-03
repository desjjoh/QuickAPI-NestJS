import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { imageSize } from 'image-size';
import { readFile } from 'node:fs/promises';

import { ImageEntity } from '../entities/image.entity';
import { ImageRepository } from '../repositories/image.repository';
import { Base } from '@/common/models/base.model';
import { useFileManager } from '@/common/handlers/file.handler';
import { join, posix } from 'path';
import { env } from '@/config/environment.config';
import { ISizeCalculationResult } from 'image-size/types/interface';

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
  url: string;
  storage_key: string;
  filename: string;
};

const fileManager = useFileManager();

const APP_URL = env.APP_URL;
const PUBLIC_ROUTE = 'public';

const publicRootPath = join(process.cwd(), PUBLIC_ROUTE);

@Injectable()
export class ImageService {
  public constructor(private readonly imageRepository: ImageRepository) {}

  private buildPublicUrl(storageKey: string): string {
    return new URL(
      posix.join(`/${PUBLIC_ROUTE}`, storageKey),
      APP_URL,
    ).toString();
  }

  public async findById(id: string): Promise<ImageEntity> {
    const image = await this.imageRepository.findById(id);

    if (!image)
      throw new NotFoundException(`Image with ID "${id}" was not found.`);

    return image;
  }

  public async create(input: CreateImageInput): Promise<ImageEntity> {
    this.validateImage(input.file);

    const metadata = await this.extractMetadata(input.file);
    const storedFile = await this.storeFile(input.file, input.folder);

    const payload: Base<ImageEntity> = {
      url: storedFile.url,
      storage_key: storedFile.storage_key,
      filename: storedFile.filename,
      size_bytes: input.file.size,
      width: metadata.width,
      height: metadata.height,
      mime_type: input.file.mimetype,
      alt_text: input.alt_text ?? null,
    };

    return this.imageRepository.createImage(payload);
  }

  public async update(input: UpdateImageInput): Promise<ImageEntity> {
    this.validateImage(input.file);

    const previousStorageKey = input.image.storage_key;

    const metadata = await this.extractMetadata(input.file);
    const storedFile = await this.storeFile(input.file, input.folder);

    const payload: Partial<Base<ImageEntity>> = {
      url: storedFile.url,
      storage_key: storedFile.storage_key,
      filename: storedFile.filename,
      size_bytes: input.file.size,
      width: metadata.width,
      height: metadata.height,
      mime_type: input.file.mimetype,
      alt_text: input.alt_text,
    };

    const updatedImage = await this.imageRepository.updateImage(
      input.image,
      payload,
    );

    await this.removeStoredFile(previousStorageKey);

    return updatedImage;
  }

  public async remove(image: ImageEntity): Promise<ImageEntity> {
    await this.removeStoredFile(image.storage_key);

    return this.imageRepository.deleteImage(image);
  }

  private validateImage(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Uploaded file must be an image.');
    }
  }

  private async extractMetadata(
    file: Express.Multer.File,
  ): Promise<ISizeCalculationResult> {
    const buffer = await readFile(file.path);

    return imageSize(buffer as unknown as Uint8Array);
  }

  private async storeFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<StoredFileResult> {
    const storageKey = join(folder, file.filename);
    const sourcePath = file.path;

    const destinationPath = join(publicRootPath, storageKey);

    await fileManager.moveFile(sourcePath, destinationPath);

    return {
      url: this.buildPublicUrl(storageKey),
      storage_key: storageKey,
      filename: file.filename,
    };
  }

  private async removeStoredFile(storageKey: string): Promise<void> {
    const filePath = join(publicRootPath, storageKey);

    await fileManager.removeFile(filePath);
  }
}
