import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { imageUploadPolicy } from '@/config/image-upload.config';
import { uploadTempRoot } from '@/config/storage.config';
import { activeUploadPaths } from '@/common/helpers/upload-tracking.helper';
import { logger } from '@/config/logger.config';

/** Only removes application-owned files older than a day; never directories. */
export async function sweepTemporaryUploads(
  root: string,
  now = Date.now(),
): Promise<void> {
  await mkdir(root, { recursive: true });
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (
      !entry.isFile() ||
      !/^quickapi-upload-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:\.[a-z0-9]{1,10})?$/.test(
        entry.name,
      )
    )
      continue;
    const path = join(root, entry.name);
    if (activeUploadPaths.has(path)) continue;
    try {
      const info = await stat(path);
      if (now - info.mtimeMs >= imageUploadPolicy.staleAfterMs)
        await rm(path, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        logger.error({ error, path }, 'Stale temporary upload cleanup failed.');
    }
  }
}

@Injectable()
export class TemporaryUploadCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: NodeJS.Timeout;
  private running = false;

  public async onModuleInit(): Promise<void> {
    await this.sweep();
    this.timer = setInterval(
      () => void this.sweep(),
      imageUploadPolicy.sweepIntervalMs,
    );
    this.timer.unref();
  }

  public onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await sweepTemporaryUploads(uploadTempRoot);
    } catch (error) {
      logger.error({ error }, 'Temporary upload sweep failed.');
    } finally {
      this.running = false;
    }
  }
}
