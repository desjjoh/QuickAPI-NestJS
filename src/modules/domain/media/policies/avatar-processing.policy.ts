import type { ImageProcessingOptions } from '@/modules/system/image-processing/types/image-processing.types';

/** Avatar-specific settings only; encoding defaults belong to the processor. */
export const avatarProcessingPolicy = Object.freeze({
  resize: Object.freeze({
    width: 256,
    height: 256,
    fit: 'cover',
    position: 'center',
    allowEnlargement: true,
  }),
  flatten: false,
  animation: 'first-frame',
} as const satisfies ImageProcessingOptions);
