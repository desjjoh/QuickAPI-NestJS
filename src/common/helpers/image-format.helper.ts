export const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const JPEG_SIGNATURE = Buffer.from([255, 216, 255]);
const GIF_SIGNATURES = ['GIF87a', 'GIF89a'];
const GIF_SIGNATURE_BYTES = 6;

// WebP: RIFF marker, four-byte file size, then WEBP at byte offset eight.
const WEBP_CONTAINER_SIGNATURE = 'RIFF';
const WEBP_FORMAT_SIGNATURE = 'WEBP';
const WEBP_FORMAT_OFFSET = 8;

export type RasterImageFormat = 'png' | 'jpeg' | 'gif' | 'webp';

/** Shared signature detection only; callers still need to decode image data. */
export function detectRasterImageFormat(
  input: Buffer,
): RasterImageFormat | undefined {
  if (input.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE))
    return 'png';

  if (input.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE))
    return 'jpeg';

  const gifHeader = input.subarray(0, GIF_SIGNATURE_BYTES).toString('ascii');

  if (GIF_SIGNATURES.includes(gifHeader)) return 'gif';

  const containerHeader = input
    .subarray(0, WEBP_CONTAINER_SIGNATURE.length)
    .toString('ascii');

  const formatHeader = input
    .subarray(
      WEBP_FORMAT_OFFSET,
      WEBP_FORMAT_OFFSET + WEBP_FORMAT_SIGNATURE.length,
    )
    .toString('ascii');

  if (
    containerHeader === WEBP_CONTAINER_SIGNATURE &&
    formatHeader === WEBP_FORMAT_SIGNATURE
  )
    return 'webp';

  return undefined;
}
