import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  storageCleanupPolicy,
  STORAGE_CLEANUP_FAILURE,
} from '../types/storage-cleanup.contract';

export const STORAGE_CLEANUP_QUEUE = 'storage-cleanup';
export const STORAGE_CLEANUP_DLQ = 'storage-cleanup-dlq';
export const STORAGE_CLEANUP_ATTEMPTS = storageCleanupPolicy.attempts;
export type StorageCleanupJob = { intentId: string };
export type StorageCleanupDeadLetter = StorageCleanupJob & {
  attempts: number;
  reason: typeof STORAGE_CLEANUP_FAILURE;
};

@Injectable()
export class StorageCleanupQueue {
  public constructor(
    @InjectQueue(STORAGE_CLEANUP_QUEUE)
    private readonly queue: Queue<StorageCleanupJob>,
    @InjectQueue(STORAGE_CLEANUP_DLQ)
    private readonly dlq: Queue<StorageCleanupDeadLetter>,
  ) {}

  public async enqueue(intentId: string): Promise<void> {
    const jobId = `storage-delete-${intentId}`;
    const existing = await this.queue.getJob(jobId);

    if (existing) {
      const state = await existing.getState();

      // Only the durable pending state permits recovery; the DB attempt budget
      // survives stalled jobs, removed jobs, restarts, and Redis data loss.
      if (state === 'failed' || state === 'completed')
        await existing.retry(state, { resetAttemptsMade: true });

      return;
    }

    await this.queue.add(
      'delete-object',
      { intentId },
      {
        jobId,
        attempts: STORAGE_CLEANUP_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: storageCleanupPolicy.retryDelayMs,
        },
        removeOnComplete: { age: 86400 },
        removeOnFail: false,
      },
    );
  }

  public async deadLetter(payload: StorageCleanupDeadLetter): Promise<void> {
    // Project known fields: callers cannot accidentally persist provider details.
    await this.dlq.add(
      'storage-cleanup-failed',
      {
        intentId: payload.intentId,
        attempts: payload.attempts,
        reason: STORAGE_CLEANUP_FAILURE,
      },
      {
        jobId: `storage-failure-${payload.intentId}`,
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );
  }
}
