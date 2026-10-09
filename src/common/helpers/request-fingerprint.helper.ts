import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { readValidatedImage } from '@/modules/domain/media/policies/image-upload.policy';

export function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}

/** Image bytes and client metadata matter; random server paths and filenames do not. */
export async function requestFingerprint(request: Request): Promise<string> {
  const file = request.file;
  const image = file ? await readValidatedImage(file) : undefined;
  return createHash('sha256')
    .update(
      canonicalJson({
        body: request.body ?? {},
        query: request.query,
        file: image
          ? {
              field: file!.fieldname,
              originalName: file!.originalname,
              mimeType: image.mimeType,
              sha256: createHash('sha256').update(image.buffer).digest('hex'),
            }
          : null,
      }),
    )
    .digest('hex');
}
