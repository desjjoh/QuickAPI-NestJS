import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { logger } from '@/config/logger.config';
import {
  STORAGE_CLEANUP_DLQ,
  StorageCleanupDeadLetter,
} from '../queues/storage-cleanup.queue';
import { cleanupWorkerConnection } from '../queues/storage-cleanup.connections';
import {
  isCleanupIntentId,
  storageCleanupPolicy,
  STORAGE_CLEANUP_FAILURE,
} from '../types/storage-cleanup.contract';

/** A future support integration can consume this stable intent ID. Never deletes objects. */
@Processor(STORAGE_CLEANUP_DLQ, { connection: cleanupWorkerConnection })
export class StorageCleanupDeadLetterProcessor extends WorkerHost {
  public async process(job: Job<StorageCleanupDeadLetter>): Promise<void> {
    if (
      !isCleanupIntentId(job.data?.intentId) ||
      job.data.attempts !== storageCleanupPolicy.attempts ||
      job.data.reason !== STORAGE_CLEANUP_FAILURE
    )
      throw new UnrecoverableError(
        'Malformed storage cleanup dead-letter job.',
      );
    logger.warn(
      { intentId: job.data.intentId, attempts: job.data.attempts },
      'Storage cleanup exhausted automatic retries; awaiting intervention.',
    );
  }

  @OnWorkerEvent('error')
  public onWorkerError(): void {
    logger.error('Storage cleanup DLQ worker error.');
  }
}
