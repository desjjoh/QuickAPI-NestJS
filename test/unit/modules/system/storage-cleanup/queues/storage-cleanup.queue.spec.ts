import {
  StorageCleanupQueue,
  STORAGE_CLEANUP_ATTEMPTS,
} from '@/modules/system/storage-cleanup/queues/storage-cleanup.queue';
import { STORAGE_CLEANUP_FAILURE } from '@/modules/system/storage-cleanup/types/storage-cleanup.contract';

describe('StorageCleanupQueue', () => {
  it('uses stable IDs and bounded exponential retries', async () => {
    const queue = { getJob: jest.fn().mockResolvedValue(null), add: jest.fn() };
    const service = new StorageCleanupQueue(queue as never, {} as never);
    await service.enqueue('intent-id');
    expect(queue.add).toHaveBeenCalledWith(
      'delete-object',
      { intentId: 'intent-id' },
      expect.objectContaining({
        jobId: 'storage-delete-intent-id',
        attempts: STORAGE_CLEANUP_ATTEMPTS,
        backoff: { type: 'exponential', delay: 1000 },
      }),
    );
  });
  it.each(['waiting', 'active', 'delayed', 'failed', 'completed'])(
    'handles a pending intent with an existing %s job',
    async (state) => {
      const job = { getState: jest.fn(async () => state), retry: jest.fn() };
      const queue = { getJob: jest.fn(async () => job), add: jest.fn() };
      await new StorageCleanupQueue(queue as never, {} as never).enqueue(
        'intent-id',
      );
      expect(queue.add).not.toHaveBeenCalled();
      if (state === 'failed' || state === 'completed')
        expect(job.retry).toHaveBeenCalledWith(state, {
          resetAttemptsMade: true,
        });
      else expect(job.retry).not.toHaveBeenCalled();
    },
  );
  it('retains a minimal stable DLQ record for future support integration', async () => {
    const dlq = { add: jest.fn() };
    const payload = {
      intentId: 'intent-id',
      attempts: 5,
      reason: STORAGE_CLEANUP_FAILURE as typeof STORAGE_CLEANUP_FAILURE,
      storage_key: 'private/key',
      provider_error: 'secret token',
    };
    await new StorageCleanupQueue({} as never, dlq as never).deadLetter(
      payload,
    );
    expect(dlq.add).toHaveBeenCalledWith(
      'storage-cleanup-failed',
      {
        intentId: payload.intentId,
        attempts: payload.attempts,
        reason: STORAGE_CLEANUP_FAILURE,
      },
      {
        jobId: 'storage-failure-intent-id',
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );
  });
});
