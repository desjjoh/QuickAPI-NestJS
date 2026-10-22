import { Injectable, ParseFilePipe, PipeTransform } from '@nestjs/common';

import { imageUploadPolicy } from '@/config/image-upload.config';
import {
  readImageUpload,
  readValidatedImage,
} from '@/modules/domain/media/policies/image-upload.policy';
import { removeTemporaryUpload } from '@/common/helpers/upload-cleanup.helper';

@Injectable()
export class ImageUploadValidationPipe implements PipeTransform {
  private readonly pipe: ParseFilePipe;
  private readonly maxSize: number;
  private readonly processing: boolean;

  constructor({
    maxSize = imageUploadPolicy.maxBytes,
    fileIsRequired = false,
    processing = false,
  }: {
    maxSize?: number;
    fileIsRequired?: boolean;
    /** Defer pixel validation to the mandatory downstream transformation. */
    processing?: boolean;
  }) {
    this.maxSize = maxSize;
    this.processing = processing;
    this.pipe = new ParseFilePipe({
      fileIsRequired,
    });
  }

  async transform(value: unknown) {
    const file = value as Express.Multer.File | undefined;

    try {
      await this.pipe.transform(value);
      if (file) {
        // Deferral requires the caller's image service to transform before PUT;
        // this pipe itself never transforms or authorizes unvalidated storage.
        const validate = this.processing ? readImageUpload : readValidatedImage;

        await validate(file, this.maxSize);
      }

      return file;
    } catch (error) {
      await removeTemporaryUpload(file).catch(() => undefined);

      throw error;
    }
  }
}
