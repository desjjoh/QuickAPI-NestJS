// PNG chunk: [4-byte data length][4-byte type][data][4-byte checksum].
export const PNG_CHUNK_LENGTH_BYTES = 4;
export const PNG_CHUNK_TYPE_BYTES = 4;
export const PNG_CHUNK_CHECKSUM_BYTES = 4;
export const PNG_CHUNK_OVERHEAD_BYTES =
  PNG_CHUNK_LENGTH_BYTES + PNG_CHUNK_TYPE_BYTES + PNG_CHUNK_CHECKSUM_BYTES;

export const PNG_ANIMATION_CONTROL_CHUNK = 'acTL';
export const PNG_END_CHUNK = 'IEND';

// EXIF orientations five through eight swap displayed width and height.
export const EXIF_AXIS_SWAP_MIN = 5;
export const EXIF_AXIS_SWAP_MAX = 8;

export const DEFAULT_WEBP_OPTIONS = {
  quality: 80,
  alphaQuality: 100,
  effort: 4,
  lossless: false,
} as const;

export const WEBP_QUALITY_RANGE = { min: 1, max: 100 } as const;
export const WEBP_EFFORT_RANGE = { min: 0, max: 6 } as const;
