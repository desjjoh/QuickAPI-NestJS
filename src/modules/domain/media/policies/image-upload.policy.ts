import { BadRequestException } from '@nestjs/common';
import { readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { imageUploadPolicy } from '@/config/image-upload.config';
import { detectRasterImageFormat } from '@/common/helpers/image-format.helper';

export type ValidatedImage = {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: string;
  extension: string;
};

const validatedUploads = new WeakMap<Express.Multer.File, ValidatedImage>();
type ImageUpload = Pick<ValidatedImage, 'buffer' | 'mimeType' | 'extension'>;
const checkedUploads = new WeakMap<Express.Multer.File, ImageUpload>();
const formats = {
  png: { mimeType: 'image/png', extension: '.png' },
  jpeg: { mimeType: 'image/jpeg', extension: '.jpg' },
  gif: { mimeType: 'image/gif', extension: '.gif' },
} as const;

/** Read once and check the upload boundary without decoding pixels. */
export async function readImageUpload(
  file: Express.Multer.File,
  maxBytes: number = imageUploadPolicy.maxBytes,
): Promise<ImageUpload> {
  if (!file) throw new BadRequestException('Image file is required.');

  const cached = checkedUploads.get(file);

  if (cached) {
    assertSize(cached.buffer.length, maxBytes);
    return cached;
  }

  const size = file.path ? (await stat(file.path)).size : file.buffer?.length;
  assertSize(size ?? 0, maxBytes);

  const buffer = file.path ? await readFile(file.path) : file.buffer;
  assertSize(buffer?.length ?? 0, maxBytes);

  // Reject non-raster formats before handing untrusted input to the decoder.
  const format = detectRasterImageFormat(buffer);

  if (!format || format === 'webp')
    throw new BadRequestException(
      'Only PNG, JPEG, and GIF images are supported.',
    );

  const detected = formats[format];
  const declared =
    file.mimetype.toLowerCase() === 'image/jpg'
      ? 'image/jpeg'
      : file.mimetype.toLowerCase();

  if (declared !== detected.mimeType)
    throw new BadRequestException(
      'The declared image MIME type does not match its contents.',
    );

  const result = { buffer, ...detected };
  checkedUploads.set(file, result);

  return result;
}

/** Unprocessed images still require a full corruption-validation decode. */
export async function readValidatedImage(
  file: Express.Multer.File,
  maxBytes: number = imageUploadPolicy.maxBytes,
): Promise<ValidatedImage> {
  const upload = await readImageUpload(file, maxBytes);
  const cached = validatedUploads.get(file);

  if (cached) return cached;

  const { buffer } = upload;

  try {
    const decoder = sharp(buffer, {
      animated: true,
      limitInputPixels: imageUploadPolicy.maxPixels,
      failOn: 'warning',
    });
    const metadata = await decoder.metadata();
    const width = metadata.width;
    const height = metadata.pageHeight ?? metadata.height;
    const pages = metadata.pages ?? 1;

    if (
      !width ||
      !height ||
      width > imageUploadPolicy.maxWidth ||
      height > imageUploadPolicy.maxHeight ||
      width * height * pages > imageUploadPolicy.maxPixels
    )
      throw new BadRequestException(
        'Image dimensions or total frame pixel count exceed the upload limits.',
      );

    // metadata() alone does not decode pixels and cannot catch corrupt payloads.
    await decoder.stats();

    const result = { ...upload, width, height };
    validatedUploads.set(file, result);

    return result;
  } catch (error) {
    if (error instanceof BadRequestException) throw error;

    throw new BadRequestException(
      'Image data is corrupt, truncated, or exceeds the pixel limit.',
    );
  }
}

function assertSize(size: number, maxBytes: number): void {
  if (size <= 0 || size > maxBytes)
    throw new BadRequestException(
      `Image must contain data and be no larger than ${maxBytes} bytes.`,
    );
}
