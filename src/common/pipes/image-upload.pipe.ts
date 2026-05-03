import { Injectable, ParseFilePipe, PipeTransform } from '@nestjs/common';
import { MaxFileSizeValidator } from '@nestjs/common';

import { megabyte } from '../constants/bytes.constants';
import { CustomFileTypeValidator } from '../validators/filetype.validator';

@Injectable()
export class ImageUploadValidationPipe implements PipeTransform {
  private readonly pipe: ParseFilePipe;

  constructor({
    maxSize = 10 * megabyte,
    fileIsRequired = false,
  }: {
    maxSize?: number;
    fileIsRequired?: boolean;
  }) {
    this.pipe = new ParseFilePipe({
      fileIsRequired,
      validators: [
        new MaxFileSizeValidator({ maxSize: maxSize }),
        new CustomFileTypeValidator([
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/gif',
        ]),
      ],
    });
  }

  async transform(value: unknown) {
    return this.pipe.transform(value);
  }
}
