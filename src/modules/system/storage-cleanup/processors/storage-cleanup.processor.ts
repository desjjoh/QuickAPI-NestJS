import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { logger } from '@/config/logger.config';
import {
  STORAGE_CLEANUP_QUEUE,
  StorageCleanupJob,
} from '../queues/storage-cleanup.queue';
import { StorageCleanupService } from '../services/storage-cleanup.service';
import { cleanupWorkerConnection } from '../queues/storage-cleanup.connections';
import {
  isCleanupIntentId,
  STORAGE_CLEANUP_WORKER_FAILURE,
} from '../types/storage-cleanup.contract';

@Processor(STORAGE_CLEANUP_QUEUE, { connection: cleanupWorkerConnection })
export class StorageCleanupProcessor extends WorkerHost {
  public constructor(private readonly cleanup: StorageCleanupService) {
    super();
  }

  public async process(job: Job<StorageCleanupJob>): Promise<void> {
    if (!isCleanupIntentId(job.data?.intentId))
      throw new UnrecoverableError('Malformed storage cleanup job.');

    try {
      await this.cleanup.deleteObject(job.data.intentId);
    } catch {
      throw new Error(STORAGE_CLEANUP_WORKER_FAILURE);
    }
  }

  @OnWorkerEvent('error')
  public onWorkerError(): void {
    logger.error('Storage cleanup worker error.');
  }
}
