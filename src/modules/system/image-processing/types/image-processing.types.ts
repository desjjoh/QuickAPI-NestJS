export type ImageFit = 'cover' | 'contain' | 'inside' | 'outside';
export type ImagePosition =
  | 'center'
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest';

export interface ImageProcessingOptions {
  readonly resize?: {
    readonly width?: number;
    readonly height?: number;
    readonly fit?: ImageFit;
    readonly position?: ImagePosition;
    /** Defaults to false. Set true for exact-size presets such as avatars. */
    readonly allowEnlargement?: boolean;
  };
  readonly webp?: {
    readonly quality?: number;
    readonly alphaQuality?: number;
    readonly effort?: number;
    readonly lossless?: boolean;
  };
  /** Opaque #RGB or #RRGGBB padding/flatten background; defaults to white. */
  readonly background?: string;
  /** Defaults to false: retain transparency. */
  readonly flatten?: boolean;
  /** Defaults to reject; animation preservation is intentionally unsupported. */
  readonly animation?: 'reject' | 'first-frame';
}

export interface ProcessedImage {
  readonly buffer: Buffer;
  readonly width: number;
  readonly height: number;
  readonly sizeBytes: number;
  readonly format: 'webp';
  readonly mimeType: 'image/webp';
  readonly extension: '.webp';
}

export type ImageProcessingErrorCode =
  | 'invalid_input'
  | 'invalid_options'
  | 'limit_exceeded'
  | 'unsupported_animation'
  | 'processing_failed'
  | 'busy';

/** Transport-independent errors: API/worker consumers choose their own mapping. */
export class ImageProcessingError extends Error {
  public constructor(
    public readonly code: ImageProcessingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ImageProcessingError';
  }
}
