import { Injectable } from '@nestjs/common';
import sharp, { type ResizeOptions } from 'sharp';
import { imageProcessingPolicy as limits } from '@/config/image-processing.config';
import {
  detectRasterImageFormat,
  PNG_SIGNATURE,
} from '@/common/helpers/image-format.helper';
import {
  DEFAULT_WEBP_OPTIONS,
  EXIF_AXIS_SWAP_MAX,
  EXIF_AXIS_SWAP_MIN,
  PNG_ANIMATION_CONTROL_CHUNK,
  PNG_CHUNK_LENGTH_BYTES,
  PNG_CHUNK_OVERHEAD_BYTES,
  PNG_CHUNK_TYPE_BYTES,
  PNG_END_CHUNK,
  WEBP_EFFORT_RANGE,
  WEBP_QUALITY_RANGE,
} from '../constants/image-processing.constants';
import {
  ImageProcessingError,
  type ImageProcessingOptions,
  type ProcessedImage,
} from '../types/image-processing.types';

const fits = new Set(['cover', 'contain', 'inside', 'outside']);

const positions = new Set([
  'center',
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
]);

@Injectable()
export class ImageProcessingService {
  private active = 0;

  private readonly waiting: Array<() => void> = [];

  /** No storage, file paths, database writes, or caller-owned buffer mutations. */
  public async process(
    input: Buffer,
    options: ImageProcessingOptions = {},
  ): Promise<ProcessedImage> {
    const settings = this.settings(options);

    if (!Buffer.isBuffer(input) || input.length === 0)
      throw new ImageProcessingError(
        'invalid_input',
        'Image data is required.',
      );

    if (input.length > limits.maxInputBytes)
      throw new ImageProcessingError(
        'limit_exceeded',
        'Image input exceeds the byte limit.',
      );

    if (!detectRasterImageFormat(input))
      throw new ImageProcessingError(
        'invalid_input',
        'Only PNG, JPEG, GIF, and WebP image data is supported.',
      );

    // Sharp does not provide full APNG frame semantics. Never silently flatten it.
    if (this.isAnimatedPng(input))
      throw new ImageProcessingError(
        'unsupported_animation',
        'APNG processing is not supported.',
      );

    // Snapshot input before waiting: later caller mutations cannot alter this job.
    const source = Buffer.from(input);

    await this.acquire();

    try {
      const pipeline = sharp(source, {
        failOn: 'warning',
        limitInputPixels: limits.maxInputPixels,
        animated: false,
      }).timeout({ seconds: limits.timeoutSeconds });

      const metadata = await pipeline.metadata();

      const width = metadata.width ?? 0;
      const height = metadata.pageHeight ?? metadata.height ?? 0;
      const pages = metadata.pages ?? 1;

      if (
        !width ||
        !height ||
        width > limits.maxDimension ||
        height > limits.maxDimension ||
        width * height * pages > limits.maxInputPixels
      )
        throw new ImageProcessingError(
          'limit_exceeded',
          'Image dimensions or frame pixels exceed the processing limits.',
        );

      if (pages > 1 && settings.animation === 'reject')
        throw new ImageProcessingError(
          'unsupported_animation',
          'Animated images require an explicit first-frame policy.',
        );

      this.assertOutputBounds(
        width,
        height,
        metadata.orientation,
        settings.resize,
      );

      pipeline.autoOrient().toColourspace('srgb');

      if (settings.resize) pipeline.resize(settings.resize);

      if (settings.flatten)
        pipeline.flatten({ background: settings.background });

      // No metadata preservation: EXIF/GPS/XMP are not copied to the derivative.
      const { data, info } = await pipeline
        .webp(settings.webp)
        .toBuffer({ resolveWithObject: true });

      if (
        info.width > limits.maxDimension ||
        info.height > limits.maxDimension ||
        info.width * info.height > limits.maxOutputPixels ||
        data.length > limits.maxOutputBytes
      )
        throw new ImageProcessingError(
          'limit_exceeded',
          'Processed image exceeds the output limits.',
        );

      return {
        buffer: data,
        width: info.width,
        height: info.height,
        sizeBytes: data.length,
        format: 'webp',
        mimeType: 'image/webp',
        extension: '.webp',
      };
    } catch (error) {
      if (error instanceof ImageProcessingError) throw error;

      throw new ImageProcessingError(
        'processing_failed',
        'Image decoding or processing failed.',
      );
    } finally {
      const next = this.waiting.shift();

      if (next) next();
      else this.active--;
    }
  }

  private acquire(): Promise<void> {
    if (this.active < limits.maxConcurrent) {
      this.active++;

      return Promise.resolve();
    }

    if (this.waiting.length >= limits.maxQueued)
      throw new ImageProcessingError(
        'busy',
        'Image processing capacity is temporarily full.',
      );

    return new Promise((resolve) => this.waiting.push(resolve));
  }

  private settings(options: ImageProcessingOptions) {
    const invalid = () => {
      throw new ImageProcessingError(
        'invalid_options',
        'Invalid image processing options.',
      );
    };

    if (!options || typeof options !== 'object') invalid();

    const background = options.background ?? '#ffffff';

    if (
      typeof background !== 'string' ||
      !/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(background)
    )
      invalid();

    if (options.flatten !== undefined && typeof options.flatten !== 'boolean')
      invalid();

    const animation = options.animation ?? 'reject';

    if (animation !== 'reject' && animation !== 'first-frame') invalid();

    if (
      options.webp !== undefined &&
      (!options.webp || typeof options.webp !== 'object')
    )
      invalid();

    const webp = {
      quality: options.webp?.quality ?? DEFAULT_WEBP_OPTIONS.quality,
      alphaQuality:
        options.webp?.alphaQuality ?? DEFAULT_WEBP_OPTIONS.alphaQuality,
      effort: options.webp?.effort ?? DEFAULT_WEBP_OPTIONS.effort,
      lossless: options.webp?.lossless ?? DEFAULT_WEBP_OPTIONS.lossless,
    };

    for (const quality of [webp.quality, webp.alphaQuality])
      if (
        !Number.isInteger(quality) ||
        quality < WEBP_QUALITY_RANGE.min ||
        quality > WEBP_QUALITY_RANGE.max
      )
        invalid();

    if (
      !Number.isInteger(webp.effort) ||
      webp.effort < WEBP_EFFORT_RANGE.min ||
      webp.effort > WEBP_EFFORT_RANGE.max ||
      typeof webp.lossless !== 'boolean'
    )
      invalid();

    let resize: ResizeOptions | undefined;

    if (options.resize !== undefined) {
      const value = options.resize;

      if (!value || typeof value !== 'object') invalid();

      if (value.width === undefined && value.height === undefined) invalid();

      for (const dimension of [value.width, value.height])
        if (
          dimension !== undefined &&
          (!Number.isInteger(dimension) ||
            dimension < 1 ||
            dimension > limits.maxDimension)
        )
          invalid();

      if (
        value.allowEnlargement !== undefined &&
        typeof value.allowEnlargement !== 'boolean'
      )
        invalid();

      const fit = value.fit ?? 'cover';
      const position = value.position ?? 'center';

      if (!fits.has(fit) || !positions.has(position)) invalid();

      if (
        value.width &&
        value.height &&
        value.width * value.height > limits.maxOutputPixels
      )
        invalid();

      resize = {
        width: value.width,
        height: value.height,
        fit,
        position,
        withoutEnlargement: !(value.allowEnlargement ?? false),
        background,
      };
    }

    return {
      resize,
      webp,
      background,
      animation,
      flatten: options.flatten ?? false,
    };
  }

  private isAnimatedPng(input: Buffer): boolean {
    const hasPngSignature = input
      .subarray(0, PNG_SIGNATURE.length)
      .equals(PNG_SIGNATURE);

    if (!hasPngSignature) return false;

    // Skip the signature, then walk complete chunks without reading past input.
    let chunkOffset = PNG_SIGNATURE.length;

    while (chunkOffset + PNG_CHUNK_OVERHEAD_BYTES <= input.length) {
      const dataLength = input.readUInt32BE(chunkOffset);
      const remainingDataBytes =
        input.length - chunkOffset - PNG_CHUNK_OVERHEAD_BYTES;

      if (dataLength > remainingDataBytes) return false;

      const typeStart = chunkOffset + PNG_CHUNK_LENGTH_BYTES;
      const typeEnd = typeStart + PNG_CHUNK_TYPE_BYTES;
      const chunkType = input.toString('ascii', typeStart, typeEnd);

      if (chunkType === PNG_ANIMATION_CONTROL_CHUNK) return true;

      if (chunkType === PNG_END_CHUNK) break;

      chunkOffset += dataLength + PNG_CHUNK_OVERHEAD_BYTES;
    }

    return false;
  }

  /** Reject oversized proportional/outside results before libvips allocates them. */
  private assertOutputBounds(
    width: number,
    height: number,
    orientation: number | undefined,
    resize: ResizeOptions | undefined,
  ): void {
    if (!resize) return;

    if (
      orientation !== undefined &&
      orientation >= EXIF_AXIS_SWAP_MIN &&
      orientation <= EXIF_AXIS_SWAP_MAX
    )
      [width, height] = [height, width];

    let outputWidth: number;
    let outputHeight: number;

    if (
      resize.width &&
      resize.height &&
      (resize.fit === 'cover' || resize.fit === 'contain')
    ) {
      outputWidth = resize.width;
      outputHeight = resize.height;
    } else {
      const ratios = [
        resize.width ? resize.width / width : undefined,
        resize.height ? resize.height / height : undefined,
      ].filter((value): value is number => value !== undefined);

      let scale =
        resize.fit === 'outside' ? Math.max(...ratios) : Math.min(...ratios);

      if (resize.withoutEnlargement) scale = Math.min(scale, 1);

      outputWidth = Math.ceil(width * scale);
      outputHeight = Math.ceil(height * scale);
    }

    if (
      outputWidth > limits.maxDimension ||
      outputHeight > limits.maxDimension ||
      outputWidth * outputHeight > limits.maxOutputPixels
    )
      throw new ImageProcessingError(
        'limit_exceeded',
        'Requested resize exceeds the output dimensions or pixel limit.',
      );
  }
}
