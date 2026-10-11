import { StorageCleanupService } from './storage-cleanup.service';
import { StorageDeletionIntentEntity } from '../entities/storage-deletion-intent.entity';
import { STORAGE_CLEANUP_ATTEMPTS } from '../queues/storage-cleanup.queue';
import { storageCleanupPolicy } from '../types/storage-cleanup.contract';
import {
  TransactionLifecycle,
  withApplicationTransaction,
} from '@/common/helpers/transaction.helper';

describe('durable storage cleanup', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  const setup = () => {
    const intent = {
      id: 'intent',
      storage_key: 'old/key.png',
      state: 'pending',
      attempts: 0,
      available_at: new Date(),
      dlq_forwarded: false,
    } as StorageDeletionIntentEntity;
    const transaction = {
      connection: {},
      queryRunner: { isTransactionActive: true },
      insert: jest.fn().mockResolvedValue({}),
      update: jest.fn(async (_entity, _criteria, fields) => {
        Object.assign(intent, fields);
      }),
    };
    const manager = {
      transaction: jest.fn(async (work) => work(transaction)),
      update: transaction.update,
    };
    const repository = {
      manager,
      findLocked: jest.fn(async () => intent),
      findDue: jest.fn(async () => [intent]),
    };
    const images = { findByStorageKey: jest.fn().mockResolvedValue(null) };
    const storage = { deleteObject: jest.fn().mockResolvedValue(undefined) };
    const queue = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      deadLetter: jest.fn().mockResolvedValue(undefined),
    };
    const objects = {
      ensureTracked: jest.fn(),
      lock: jest.fn().mockResolvedValue({ state: 'attached' }),
      markDeleting: jest.fn(),
      markDeleted: jest.fn(),
      abandoned: jest.fn().mockResolvedValue([]),
    };
    const service = new StorageCleanupService(
      repository as never,
      images as never,
      storage as never,
      queue as never,
      { get: () => 'request-1' } as never,
      objects as never,
    );
    return {
      intent,
      transaction,
      manager,
      repository,
      images,
      storage,
      queue,
      objects,
      service,
    };
  };

  it('stores a correlated intent through the mutation manager without calling Redis or storage', async () => {
    const { transaction, queue, storage, service } = setup();
    const id = await service.schedule(
      transaction as never,
      'old/key.png',
      'image_removed',
    );
    expect(transaction.insert).toHaveBeenCalledWith(
      StorageDeletionIntentEntity,
      expect.objectContaining({
        id,
        storage_key: 'old/key.png',
        reason: 'image_removed',
        request_id: 'request-1',
        state: 'pending',
        attempts: 0,
      }),
    );
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('rejects scheduling outside the originating database transaction', async () => {
    const { manager, transaction, service } = setup();
    await expect(
      service.schedule(manager as never, 'old.png', 'image_removed'),
    ).rejects.toThrow('require the originating mutation transaction');
    expect(transaction.insert).not.toHaveBeenCalled();
  });

  it('rechecks current references on a retry rather than trusting the original deletion request', async () => {
    const { intent, images, storage, service } = setup();
    storage.deleteObject.mockRejectedValueOnce(new Error('temporary outage'));
    await expect(service.deleteObject(intent.id)).rejects.toThrow();
    images.findByStorageKey.mockResolvedValue({ id: 'now-referenced' });
    await expect(service.deleteObject(intent.id)).resolves.toBe('blocked');
    expect(intent.state).toBe('blocked');
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
  });

  it('claims due work before dispatching outside the database transaction', async () => {
    const { manager, intent, queue, service } = setup();
    queue.enqueue.mockImplementation(async () => {
      expect(manager.transaction).toHaveReturned();
    });
    await service.dispatch();
    expect(queue.enqueue).toHaveBeenCalledWith(intent.id);
    expect(intent.available_at.getTime()).toBeGreaterThan(Date.now());
  });

  it('retains a pending intent on Redis failure', async () => {
    const { intent, queue, service } = setup();
    queue.enqueue.mockRejectedValue(new Error('Redis down'));
    await expect(service.dispatch()).resolves.toBeUndefined();
    expect(intent.state).toBe('pending');
  });

  it('continues dispatching existing intents when reconciliation is unavailable', async () => {
    const { intent, queue, service } = setup();
    jest
      .spyOn(service, 'reconcile')
      .mockRejectedValueOnce(new Error('HEAD unavailable'));
    await service.dispatch();
    expect(queue.enqueue).toHaveBeenCalledWith(intent.id);
  });

  it('completes deletion and makes duplicate deliveries a no-op', async () => {
    const { intent, storage, service } = setup();
    await service.deleteObject(intent.id);
    await service.deleteObject(intent.id);
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
    expect(storage.deleteObject).toHaveBeenCalledWith({
      key: intent.storage_key,
    });
    expect(intent.state).toBe('completed');
    expect(intent.attempts).toBe(1);
  });

  it('blocks deletion of a currently referenced object', async () => {
    const { intent, images, storage, service } = setup();
    images.findByStorageKey.mockResolvedValue({ id: 'current-image' });
    await service.deleteObject(intent.id);
    expect(intent.state).toBe('blocked');
    expect(intent.attempts).toBe(0);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('commits sanitized failure accounting, exhausts a durable retry budget, and never retries terminal work', async () => {
    const { intent, storage, service } = setup();
    storage.deleteObject.mockRejectedValue(
      new Error('secret provider response'),
    );
    for (let attempt = 0; attempt < STORAGE_CLEANUP_ATTEMPTS; attempt++) {
      await expect(service.deleteObject(intent.id)).rejects.toThrow(
        'Storage object deletion failed.',
      );
      expect(intent.attempts).toBe(attempt + 1);
    }
    expect(intent.state).toBe('failed');
    expect(intent.last_error).not.toContain('secret');
    await service.deleteObject(intent.id);
    expect(storage.deleteObject).toHaveBeenCalledTimes(
      STORAGE_CLEANUP_ATTEMPTS,
    );
  });

  it('recovers terminal failure forwarding after a Redis outage without resuming deletion', async () => {
    const { intent, queue, storage, service } = setup();
    Object.assign(intent, {
      state: 'failed',
      attempts: STORAGE_CLEANUP_ATTEMPTS,
    });
    queue.deadLetter.mockRejectedValueOnce(new Error('Redis down'));
    await service.dispatch();
    expect(intent.dlq_forwarded).toBe(false);
    await service.dispatch();
    expect(queue.deadLetter).toHaveBeenLastCalledWith({
      intentId: intent.id,
      attempts: STORAGE_CLEANUP_ATTEMPTS,
      reason: 'Storage object deletion failed.',
    });
    expect(intent.dlq_forwarded).toBe(true);
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('reuses the DLQ identity after publication succeeds but SQL acknowledgement fails', async () => {
    const { intent, queue, service, manager, storage } = setup();
    Object.assign(intent, {
      state: 'failed',
      attempts: STORAGE_CLEANUP_ATTEMPTS,
    });
    manager.update = jest
      .fn(manager.update)
      .mockRejectedValueOnce(new Error('SQL acknowledgement unavailable'));
    await service.dispatch();
    expect(intent.dlq_forwarded).toBe(false);
    await service.dispatch();
    expect(intent.dlq_forwarded).toBe(true);
    expect(queue.deadLetter).toHaveBeenCalledTimes(2);
    expect(queue.deadLetter.mock.calls[0][0]).toEqual(
      queue.deadLetter.mock.calls[1][0],
    );
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('ignores a missing intent', async () => {
    const { repository, service, storage } = setup();
    repository.findLocked.mockResolvedValue(null as never);
    await expect(service.deleteObject('missing')).resolves.toBe('missing');
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it.each(['completed', 'blocked', 'failed'] as const)(
    'acknowledges stale deliveries for %s without reopening ownership or resetting attempts',
    async (state) => {
      const { intent, service, storage, objects, transaction } = setup();
      Object.assign(intent, { state, attempts: STORAGE_CLEANUP_ATTEMPTS });
      await expect(service.deleteObject(intent.id)).resolves.toBe(state);
      expect(storage.deleteObject).not.toHaveBeenCalled();
      expect(objects.lock).not.toHaveBeenCalled();
      expect(transaction.update).not.toHaveBeenCalled();
    },
  );

  it('does not spend provider attempts on failed SQL/reference checks', async () => {
    const { intent, service, images, storage } = setup();
    images.findByStorageKey.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await expect(service.deleteObject(intent.id)).rejects.toThrow(
      'database unavailable',
    );
    expect(intent.state).toBe('pending');
    expect(intent.attempts).toBe(0);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('records an uncertain DELETE timeout as a failed attempt before throwing', async () => {
    jest.useFakeTimers();
    const { intent, service, storage, objects } = setup();
    storage.deleteObject.mockImplementation(() => new Promise(() => undefined));
    const rejected = expect(service.deleteObject(intent.id)).rejects.toThrow(
      'Storage object deletion failed.',
    );
    await jest.advanceTimersByTimeAsync(
      storageCleanupPolicy.operationTimeoutMs,
    );
    await rejected;
    expect(intent).toMatchObject({
      state: 'pending',
      attempts: 1,
      last_error: 'Storage object deletion failed.',
    });
    expect(objects.markDeleting).toHaveBeenCalled();
    expect(objects.markDeleted).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('bounds Redis dispatch time while retaining pending work', async () => {
    jest.useFakeTimers();
    const { intent, service, queue } = setup();
    queue.enqueue.mockImplementation(() => new Promise(() => undefined));
    const dispatch = service.dispatch();
    await jest.advanceTimersByTimeAsync(
      storageCleanupPolicy.operationTimeoutMs,
    );
    await dispatch;
    expect(intent).toMatchObject({ state: 'pending', attempts: 0 });
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['deleteObject', 'reconcile', 'dispatch'] as const)(
    'rejects %s inside a request transaction',
    async (operation) => {
      const { service, manager, storage } = setup();
      await expect(
        withApplicationTransaction(
          manager as never,
          new TransactionLifecycle(),
          async () => {
            if (operation === 'deleteObject')
              await service.deleteObject('intent');
            else await service[operation]();
          },
        ),
      ).rejects.toThrow('outside request transactions');
      expect(manager.transaction).not.toHaveBeenCalled();
      expect(storage.deleteObject).not.toHaveBeenCalled();
    },
  );
});
