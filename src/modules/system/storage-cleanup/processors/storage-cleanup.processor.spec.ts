import { StorageCleanupProcessor } from './storage-cleanup.processor';
import { StorageCleanupDeadLetterProcessor } from './storage-cleanup-dlq.processor';
import { STORAGE_CLEANUP_FAILURE } from '../types/storage-cleanup.contract';
import { UnrecoverableError } from 'bullmq';

describe('storage cleanup processors', () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  it('loads the durable intent rather than trusting a queued storage key', async () => {
    const cleanup = { deleteObject: jest.fn() };
    await new StorageCleanupProcessor(cleanup as never).process({
      data: { intentId: id },
    } as never);
    expect(cleanup.deleteObject).toHaveBeenCalledWith(id);
  });
  it('does not leak provider failure details into Redis', async () => {
    const cleanup = {
      deleteObject: jest.fn().mockRejectedValue(new Error('secret URL')),
    };
    await expect(
      new StorageCleanupProcessor(cleanup as never).process({
        data: { intentId: id },
      } as never),
    ).rejects.toThrow(
      'Storage cleanup attempt failed; inspect the durable intent.',
    );
  });
  it.each([
    undefined,
    {},
    { intentId: 'invalid' },
    { intentId: '-'.repeat(36) },
  ])('rejects malformed cleanup jobs %j', async (data) => {
    const cleanup = { deleteObject: jest.fn() };
    await expect(
      new StorageCleanupProcessor(cleanup as never).process({
        data,
      } as never),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(cleanup.deleteObject).not.toHaveBeenCalled();
  });
  it('accepts a stable failure identity without executing deletion', async () => {
    await expect(
      new StorageCleanupDeadLetterProcessor().process({
        data: {
          intentId: id,
          attempts: 5,
          reason: STORAGE_CLEANUP_FAILURE,
        },
      } as never),
    ).resolves.toBeUndefined();
  });
  it.each([
    undefined,
    {},
    { intentId: id, attempts: -1, reason: STORAGE_CLEANUP_FAILURE },
    { intentId: id, attempts: 4, reason: STORAGE_CLEANUP_FAILURE },
    { intentId: id, attempts: 6, reason: STORAGE_CLEANUP_FAILURE },
    { intentId: id, attempts: 5, reason: 'secret provider message' },
    { intentId: '-'.repeat(36), attempts: 5, reason: STORAGE_CLEANUP_FAILURE },
  ])('rejects malformed dead letters %j without retrying', async (data) => {
    await expect(
      new StorageCleanupDeadLetterProcessor().process({ data } as never),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });
});
