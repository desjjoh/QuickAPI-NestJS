import { Injectable, ParseFilePipe, PipeTransform } from '@nestjs/common';

import { imageUploadPolicy } from '@/config/image-upload.config';
import { readValidatedImage } from '@/modules/domain/media/policies/image-upload.policy';
import { removeTemporaryUpload } from '@/common/helpers/upload-cleanup.helper';

@Injectable()
export class ImageUploadValidationPipe implements PipeTransform {
  private readonly pipe: ParseFilePipe;
  private readonly maxSize: number;

  constructor({
    maxSize = imageUploadPolicy.maxBytes,
    fileIsRequired = false,
  }: {
    maxSize?: number;
    fileIsRequired?: boolean;
  }) {
    this.maxSize = maxSize;
    this.pipe = new ParseFilePipe({
      fileIsRequired,
    });
  }

  async transform(value: unknown) {
    const file = value as Express.Multer.File | undefined;
    try {
      await this.pipe.transform(value);
      if (file) await readValidatedImage(file, this.maxSize);
      return file;
    } catch (error) {
      await removeTemporaryUpload(file).catch(() => undefined);
      throw error;
    }
  }
}
