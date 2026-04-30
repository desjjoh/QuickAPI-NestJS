import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ImageEntity } from '../entities/image.entity';
import { ImageRepository } from '../repositories/image.repository';
import { Base } from '@/common/models/base.model';

type CreateImageInput = {
  file: Express.Multer.File;
  alt_text?: string | null;
  folder: string;
};

type UpdateImageInput = {
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

type ImageMetadata = {
  width: number;
  height: number;
};

@Injectable()
export class ImageService {
  public constructor(private readonly imageRepository: ImageRepository) {}

  public async findById(id: string): Promise<ImageEntity> {
    const image = await this.imageRepository.findById(id);

    if (!image) {
      throw new NotFoundException(`Image with ID "${id}" was not found.`);
    }

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
  ): Promise<ImageMetadata> {
    void file;
    // TODO:
    // - Read file buffer/path
    // - Use image-size or sharp
    // - Return actual width/height
    //
    // Current convention:
    // 0 means unavailable/unknown.

    return {
      width: 0,
      height: 0,
    };
  }

  private async storeFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<StoredFileResult> {
    // TODO:
    // Replace with FileStorageService/PublicStorageService later.
    //
    // Expected behavior:
    // - Move file from temp upload path to public/uploads/<folder>
    // - Return public URL and internal storage key.

    return {
      url: `/uploads/${folder}/${file.filename}`,
      storage_key: `uploads/${folder}/${file.filename}`,
      filename: file.filename,
    };
  }

  private async removeStoredFile(storageKey: string): Promise<void> {
    void storageKey;
    // TODO:
    // Replace with FileStorageService/PublicStorageService later.
    //
    // Expected behavior:
    // - Delete the file from local public storage
    // - Ignore missing files if appropriate
  }
}
