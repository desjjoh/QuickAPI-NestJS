import { imageUploadPolicy } from './image-upload.config';

/** Server-owned resource limits, never overridable by an upload request. */
export const imageProcessingPolicy = Object.freeze({
  maxInputBytes: imageUploadPolicy.maxBytes,
  maxInputPixels: imageUploadPolicy.maxPixels,
  maxDimension: imageUploadPolicy.maxWidth,
  maxOutputPixels: imageUploadPolicy.maxPixels,
  maxOutputBytes: imageUploadPolicy.maxBytes,
  timeoutSeconds: 10,
  maxConcurrent: 2,
  maxQueued: 4,
});
