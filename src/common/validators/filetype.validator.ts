import { FileValidator } from '@nestjs/common';
import { isArray } from 'class-validator';

export class CustomFileTypeValidator extends FileValidator {
  constructor(private readonly allowedTypes: string[]) {
    super({});
    if (!isArray(allowedTypes) || allowedTypes.length === 0) {
      throw new Error(
        'CustomFileTypeValidator: allowedTypes must be a non-empty array',
      );
    }
  }

  isValid(file?: Express.Multer.File): boolean | Promise<boolean> {
    if (!file?.mimetype) return false;
    return this.allowedTypes.includes(file.mimetype);
  }

  buildErrorMessage(): string {
    return `Validation failed (current file type is invalid. Allowed types: ${this.allowedTypes.join(', ')})`;
  }
}
