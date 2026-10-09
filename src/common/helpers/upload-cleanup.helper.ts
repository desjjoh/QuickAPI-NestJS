import { rm } from 'node:fs/promises';
import type { Request } from 'express';
import { logger } from '@/config/logger.config';
import {
  activeUploadPaths,
  requestUploadPaths,
} from './upload-tracking.helper';

/** Idempotent so request cleanup and domain cleanup can safely overlap. */
export async function removeTemporaryUpload(
  file?: Express.Multer.File,
): Promise<void> {
  if (!file?.path) return;
  try {
    await rm(file.path, { force: true });
  } catch (error) {
    logger.error(
      { error, path: file.path },
      'Temporary upload cleanup failed.',
    );
    throw error;
  } finally {
    activeUploadPaths.delete(file.path);
  }
}

export async function cleanupRequestUpload(request: Request): Promise<void> {
  const paths = new Set(requestUploadPaths(request));
  if (request.file?.path) paths.add(request.file.path);
  const results = await Promise.allSettled(
    [...paths].map((path) =>
      removeTemporaryUpload({ path } as Express.Multer.File),
    ),
  );
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length)
    throw new AggregateError(
      failures.map((result) => result.reason),
      'Temporary upload cleanup failed.',
    );
}
