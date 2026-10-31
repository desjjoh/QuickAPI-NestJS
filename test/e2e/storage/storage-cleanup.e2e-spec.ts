import { jest } from '@jest/globals';
import { getQueueToken } from '@nestjs/bullmq';
import { createTestApp } from '../../helpers/test-app';
import { StorageCleanupDeadLetterProcessor } from '@/modules/system/storage-cleanup/processors/storage-cleanup-dlq.processor';
import { StorageObjectRepository } from '@/modules/system/storage/repositories/storage-object.repository';
import { StorageObjectService } from '@/modules/system/storage/services/storage-object.service';
import { StorageObjectEntity } from '@/modules/system/storage/entities/storage-object.entity';
import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { DataSource } from 'typeorm';
import { redisConnection } from '@/config/redis.config';
import { RequestContext } from '@/common/store/request-context.store';
import { runInTransaction } from '@/common/helpers/transaction.helper';
import { StorageDeletionIntentEntity } from '@/modules/system/storage-cleanup/entities/storage-deletion-intent.entity';
import { StorageDeletionIntentRepository } from '@/modules/system/storage-cleanup/repositories/storage-deletion-intent.repository';
import { ImageRepository } from '@/modules/domain/media/repositories/image.repository';
import { ImageEntity } from '@/modules/domain/media/entities/image.entity';
import { StorageCleanupService } from '@/modules/system/storage-cleanup/services/storage-cleanup.service';
import { StorageCleanupProcessor } from '@/modules/system/storage-cleanup/processors/storage-cleanup.processor';
import {
  StorageCleanupQueue,
  StorageCleanupJob,
  StorageCleanupDeadLetter,
  STORAGE_CLEANUP_ATTEMPTS,
  STORAGE_CLEANUP_QUEUE,
  STORAGE_CLEANUP_DLQ,
} from '@/modules/system/storage-cleanup/queues/storage-cleanup.queue';
import {
  closeTestDataSource,
  initializeTestDataSource,
  resetMutableTables,
} from '../../helpers/database/test-database';

describe('durable storage cleanup (disposable MySQL and Redis)', () => {
  let source: DataSource;
  const storage = {
    deleteObject: jest.fn<(input: { key: string }) => Promise<void>>(),
    objectExists: jest.fn<(key: string) => Promise<boolean>>(),
  };
  const producer = {
    enqueue: jest.fn<(id: string) => Promise<void>>(),
    deadLetter: jest.fn<(payload: StorageCleanupDeadLetter) => Promise<void>>(),
  };
  let cleanup: StorageCleanupService;
  let objects: StorageObjectService;
  let objectRepository: StorageObjectRepository;
  beforeAll(async () => {
    source = await initializeTestDataSource();
  });
  beforeEach(async () => {
    jest.resetAllMocks();
    await resetMutableTables(source);
    objectRepository = new StorageObjectRepository(source);
    objects = new StorageObjectService(objectRepository);
    storage.deleteObject.mockResolvedValue(undefined);
    storage.objectExists.mockResolvedValue(false);
    producer.enqueue.mockResolvedValue(undefined);
    producer.deadLetter.mockResolvedValue(undefined);
    cleanup = new StorageCleanupService(
      new StorageDeletionIntentRepository(source),
      new ImageRepository(source),
      storage as never,
      producer as never,
      new RequestContext(),
      objects,
    );
  });
  afterAll(async () => {
    await closeTestDataSource(source);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await objectRepository.onModuleDestroy();
  });

  const schedule = (key = 'old/key.png') =>
    runInTransaction(source.manager, (manager) =>
      cleanup.schedule(manager, key, 'image_removed'),
    );

  const imageFor = (manager: DataSource['manager'], key: string) =>
    manager.save(
      ImageEntity,
      manager.create(ImageEntity, {
        storage_key: key,
        filename: key.split('/').pop(),
        size_bytes: 1,
        width: 1,
        height: 1,
        mime_type: 'image/png',
        alt_text: 'Image',
        decorative: false,
      }),
    );
  const uploaded = async () => {
    const reservation = await objects.reserve('images', '.png');
    await objects.upload(reservation.storage_key, async () => undefined);
    return reservation.storage_key;
  };
  const expire = (key: string) =>
    source.manager.update(
      StorageObjectEntity,
      { storage_key: key },
      { expires_at: new Date(0) },
    );
  const signal = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };

  it('keeps reservations after request rollback without starving a single-connection application pool', async () => {
    const main = new DataSource({
      ...source.options,
      extra: { ...source.options.extra, connectionLimit: 1 },
    });
    await main.initialize();
    const repository = new StorageObjectRepository(main);
    const isolated = new StorageObjectService(repository);
    let key!: string;
    try {
      await expect(
        runInTransaction(main.manager, async () => {
          key = (await isolated.reserve('images', '.png')).storage_key;
          throw new Error('request failed');
        }),
      ).rejects.toThrow('request failed');
      expect(
        await source
          .getRepository(StorageObjectEntity)
          .findOneByOrFail({ storage_key: key }),
      ).toMatchObject({ state: 'reserved' });
    } finally {
      await repository.onModuleDestroy();
      await main.destroy();
    }
  }, 10000);

  it('reconciles a PUT accepted before a crash and creates exactly one durable cleanup intent', async () => {
    const key = (await objects.reserve('images', '.png')).storage_key;
    const blobs = new Set<string>();
    await expect(
      objects.upload(key, async () => {
        blobs.add(key);
        throw new Error('crash after provider acceptance');
      }),
    ).rejects.toThrow('crash');
    expect(
      (
        await source
          .getRepository(StorageObjectEntity)
          .findOneByOrFail({ storage_key: key })
      ).state,
    ).toBe('reserved');
    await expire(key);
    await Promise.all([cleanup.reconcile(), cleanup.reconcile()]);
    const intents = await source
      .getRepository(StorageDeletionIntentEntity)
      .findBy({ storage_key: key });
    expect(intents).toHaveLength(1);
    expect(intents[0].reason).toBe('upload_abandoned');
    storage.deleteObject.mockImplementation(async (input) => {
      blobs.delete((input as { key: string }).key);
    });
    await cleanup.deleteObject(intents[0].id);
    expect(blobs.has(key)).toBe(false);
    expect(
      (
        await source
          .getRepository(StorageObjectEntity)
          .findOneByOrFail({ storage_key: key })
      ).state,
    ).toBe('deleted');
  });

  it('recovers uploaded objects and rolled-back attachments after restart without touching committed or recent uploads', async () => {
    const abandoned = await uploaded();
    await expect(
      runInTransaction(source.manager, async (manager) => {
        await objects.attach(manager, abandoned);
        await imageFor(manager, abandoned);
        throw new Error('crash before commit');
      }),
    ).rejects.toThrow('crash');
    const current = await uploaded();
    await runInTransaction(source.manager, async (manager) => {
      await objects.attach(manager, current);
      await imageFor(manager, current);
    });
    const recent = await uploaded();
    await expire(abandoned);
    await expire(current);
    await cleanup.reconcile();
    expect(
      (await source.getRepository(StorageDeletionIntentEntity).find()).map(
        (intent) => intent.storage_key,
      ),
    ).toEqual([abandoned]);
    expect(
      (
        await source
          .getRepository(StorageObjectEntity)
          .findOneByOrFail({ storage_key: current })
      ).state,
    ).toBe('attached');
    expect(
      (
        await source
          .getRepository(StorageObjectEntity)
          .findOneByOrFail({ storage_key: recent })
      ).state,
    ).toBe('uploaded');
  });

  it('skips a paused active PUT even when its reservation deadline has elapsed', async () => {
    const key = (await objects.reserve('images', '.png')).storage_key;
    await expire(key);
    const started = signal();
    const release = signal();
    const upload = objects.upload(key, async () => {
      started.resolve();
      await release.promise;
    });
    try {
      await started.promise;
      await cleanup.reconcile();
      expect(
        await source.getRepository(StorageDeletionIntentEntity).count(),
      ).toBe(0);
    } finally {
      release.resolve();
      await upload;
    }
    expect(
      (
        await source
          .getRepository(StorageObjectEntity)
          .findOneByOrFail({ storage_key: key })
      ).state,
    ).toBe('uploaded');
  });

  it('lets committed attachment win the race and blocks cleanup of its object', async () => {
    const key = await uploaded();
    const intent = await schedule(key);
    const started = signal();
    const release = signal();
    const attachment = runInTransaction(source.manager, async (manager) => {
      await objects.attach(manager, key);
      await imageFor(manager, key);
      started.resolve();
      await release.promise;
    });
    await started.promise;
    const deletion = cleanup.deleteObject(intent);
    release.resolve();
    await Promise.all([attachment, deletion]);
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(
      (
        await source
          .getRepository(StorageDeletionIntentEntity)
          .findOneByOrFail({ id: intent })
      ).state,
    ).toBe('blocked');
  });

  it('fences attachment before DELETE, preserving the fence through provider failure and retries', async () => {
    const key = await uploaded();
    const intent = await schedule(key);
    const started = signal();
    const release = signal();
    storage.deleteObject.mockImplementationOnce(async () => {
      started.resolve();
      await release.promise;
      throw new Error('provider outcome uncertain');
    });
    const deletion = cleanup.deleteObject(intent);
    // Observe the rejection immediately so a test failure cannot leave an unhandled rejection.
    const failedDeletion = expect(deletion).rejects.toThrow(
      'Storage object deletion failed.',
    );
    try {
      await started.promise;
      await expect(
        runInTransaction(source.manager, (manager) =>
          objects.attach(manager, key),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    } finally {
      release.resolve();
      await failedDeletion;
    }
    expect(
      (
        await source
          .getRepository(StorageObjectEntity)
          .findOneByOrFail({ storage_key: key })
      ).state,
    ).toBe('deleting');
    await cleanup.deleteObject(intent);
    await expect(
      runInTransaction(source.manager, (manager) =>
        objects.attach(manager, key),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      (
        await source
          .getRepository(StorageObjectEntity)
          .findOneByOrFail({ storage_key: key })
      ).state,
    ).toBe('deleted');
  });

  it('recovers a late provider write and stops probing only after confirmed absence', async () => {
    const key = await uploaded();
    const first = await schedule(key);
    await cleanup.deleteObject(first);
    await expire(key);
    storage.objectExists.mockResolvedValueOnce(true);
    await cleanup.reconcile();
    const intents = await source
      .getRepository(StorageDeletionIntentEntity)
      .findBy({ storage_key: key });
    expect(intents).toHaveLength(2);
    const late = intents.find(
      (intent) => intent.reason === 'late_upload_detected',
    )!;
    expect(late.state).toBe('pending');
    await expect(
      runInTransaction(source.manager, (manager) =>
        objects.attach(manager, key),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await cleanup.deleteObject(late.id);
    await expire(key);
    storage.objectExists.mockRejectedValueOnce(new Error('HEAD outage'));
    await expect(cleanup.reconcile()).rejects.toThrow('HEAD outage');
    expect(
      await source
        .getRepository(StorageObjectEntity)
        .findOneByOrFail({ storage_key: key }),
    ).toMatchObject({ state: 'deleted', expires_at: new Date(0) });
    await cleanup.reconcile();
    expect(
      await source
        .getRepository(StorageObjectEntity)
        .findOneByOrFail({ storage_key: key }),
    ).toMatchObject({ state: 'deleted', expires_at: null });
    await cleanup.reconcile();
    expect(storage.objectExists).toHaveBeenCalledTimes(3);
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
    expect(
      await source.getRepository(StorageDeletionIntentEntity).count(),
    ).toBe(2);
  });

  it('keeps a committed deletion fence when SQL completion fails after provider deletion', async () => {
    const key = await uploaded();
    const id = await schedule(key);
    jest
      .spyOn(objects, 'markDeleted')
      .mockRejectedValueOnce(new Error('completion failed'));
    await expect(cleanup.deleteObject(id)).rejects.toThrow('completion failed');
    expect(
      await source
        .getRepository(StorageObjectEntity)
        .findOneByOrFail({ storage_key: key }),
    ).toMatchObject({ state: 'deleting' });
    expect(
      await source
        .getRepository(StorageDeletionIntentEntity)
        .findOneByOrFail({ id }),
    ).toMatchObject({ state: 'pending', attempts: 0 });
    await expect(
      runInTransaction(source.manager, (manager) =>
        objects.attach(manager, key),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await cleanup.deleteObject(id);
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
    expect(
      await source
        .getRepository(StorageObjectEntity)
        .findOneByOrFail({ storage_key: key }),
    ).toMatchObject({ state: 'deleted' });
  });

  it('initializes both workers without Redis configuration warnings while keeping producers fail-fast', async () => {
    const errors = jest.spyOn(console, 'error');
    const app = await createTestApp();
    try {
      for (const processor of [
        StorageCleanupProcessor,
        StorageCleanupDeadLetterProcessor,
      ]) {
        const worker = app.get(processor).worker;
        expect((await worker.client).status).toBe('ready');
        expect(worker.opts.connection).toMatchObject({
          maxRetriesPerRequest: null,
          enableOfflineQueue: true,
        });
      }
      for (const queue of [STORAGE_CLEANUP_QUEUE, STORAGE_CLEANUP_DLQ]) {
        expect((await app.get<Queue>(getQueueToken(queue)).client).status).toBe(
          'ready',
        );
        expect(
          app.get<Queue>(getQueueToken(queue)).opts.connection,
        ).toMatchObject({
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });
      }
      expect(
        errors.mock.calls.filter((args) =>
          String(args[0]).includes('maxRetriesPerRequest'),
        ),
      ).toEqual([]);
    } finally {
      await app.close();
      errors.mockRestore();
    }
  });

  it('rolls back intents with the originating transaction', async () => {
    await expect(
      runInTransaction(source.manager, async (manager) => {
        await cleanup.schedule(manager, 'rollback.png', 'image_removed');
        throw new Error('mutation rolled back');
      }),
    ).rejects.toThrow('mutation rolled back');
    expect(
      await source.getRepository(StorageDeletionIntentEntity).count(),
    ).toBe(0);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('recovers undispatched work after restart, tolerates Redis failure, and serializes duplicate deliveries', async () => {
    const id = await schedule();
    producer.enqueue.mockRejectedValueOnce(new Error('Redis down'));
    await cleanup.dispatch();
    expect(
      (
        await source
          .getRepository(StorageDeletionIntentEntity)
          .findOneByOrFail({ id })
      ).state,
    ).toBe('pending');
    await source.manager.update(
      StorageDeletionIntentEntity,
      { id },
      { available_at: new Date(0) },
    );
    const restarted = new StorageCleanupService(
      new StorageDeletionIntentRepository(source),
      new ImageRepository(source),
      storage as never,
      producer as never,
      new RequestContext(),
      objects,
    );
    await Promise.all([restarted.dispatch(), cleanup.dispatch()]);
    expect(producer.enqueue).toHaveBeenCalledTimes(2);
    await Promise.all([restarted.deleteObject(id), cleanup.deleteObject(id)]);
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
    expect(
      await source
        .getRepository(StorageDeletionIntentEntity)
        .findOneByOrFail({ id }),
    ).toMatchObject({ state: 'completed', attempts: 1 });
  });

  it('blocks an object referenced by a current image', async () => {
    const image = await source.manager.save(
      ImageEntity,
      source.manager.create(ImageEntity, {
        storage_key: 'current/image.png',
        filename: 'image.png',
        size_bytes: 1,
        width: 1,
        height: 1,
        mime_type: 'image/png',
        alt_text: 'Image',
        decorative: false,
      }),
    );
    const id = await schedule(image.storage_key);
    await cleanup.deleteObject(id);
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(
      await source
        .getRepository(StorageDeletionIntentEntity)
        .findOneByOrFail({ id }),
    ).toMatchObject({ state: 'blocked', attempts: 0 });
  });

  it('retains the SQL retry budget after losing a partially processed Redis job', async () => {
    const id = await schedule('redis-loss/object.png');
    storage.deleteObject.mockRejectedValue(new Error('provider unavailable'));
    for (let attempt = 0; attempt < 2; attempt++)
      await expect(cleanup.deleteObject(id)).rejects.toThrow(
        'Storage object deletion failed.',
      );

    const name = `e2e-storage-${randomUUID()}`;
    const connection = { ...redisConnection, maxRetriesPerRequest: null };
    const queue = new Queue<StorageCleanupJob>(name, { connection });
    const events = new QueueEvents(name, { connection });
    const queueService = new StorageCleanupQueue(queue, {} as never);
    const processor = new StorageCleanupProcessor(cleanup);
    let worker: Worker<StorageCleanupJob> | undefined;
    try {
      await events.waitUntilReady();
      await queueService.enqueue(id);
      const lost = (await queue.getJob(`storage-delete-${id}`))!;
      await lost.remove(); // Simulate lost queue state, never flush shared Redis.
      await queueService.enqueue(id);
      worker = new Worker<StorageCleanupJob>(
        name,
        (job) => processor.process(job),
        { connection },
      );
      const replacement = (await queue.getJob(`storage-delete-${id}`))!;
      // The fresh Redis job has five tries, but SQL allows only the three remaining provider calls.
      // A subsequent delivery acknowledges the already-terminal intent without deletion.
      await replacement.waitUntilFinished(events, 25000);
      expect(storage.deleteObject).toHaveBeenCalledTimes(
        STORAGE_CLEANUP_ATTEMPTS,
      );
      expect(
        await source
          .getRepository(StorageDeletionIntentEntity)
          .findOneByOrFail({ id }),
      ).toMatchObject({ state: 'failed', attempts: STORAGE_CLEANUP_ATTEMPTS });
    } finally {
      await worker?.close();
      await events.close();
      await queue.obliterate();
      await queue.close();
    }
  }, 35000);

  it('retries through BullMQ, persists exhaustion, and recovers DLQ forwarding without restarting deletion', async () => {
    // These uniquely named queues are test-owned; never clear application queues.
    const name = `e2e-storage-${randomUUID()}`;
    const connection = { ...redisConnection, maxRetriesPerRequest: null };
    const queue = new Queue<StorageCleanupJob>(name, { connection });
    const dlq = new Queue<StorageCleanupDeadLetter>(`${name}-dlq`, {
      connection,
    });
    const events = new QueueEvents(name, { connection });
    const queueService = new StorageCleanupQueue(queue, dlq);
    const service = new StorageCleanupService(
      new StorageDeletionIntentRepository(source),
      new ImageRepository(source),
      storage as never,
      queueService,
      new RequestContext(),
      objects,
    );
    const processor = new StorageCleanupProcessor(service);
    const worker = new Worker<StorageCleanupJob>(
      name,
      (job) => processor.process(job),
      { connection },
    );
    try {
      await events.waitUntilReady();
      const id = await runInTransaction(source.manager, (manager) =>
        service.schedule(manager, 'failed/object.png', 'image_removed'),
      );
      storage.deleteObject.mockRejectedValue(
        new Error('secret provider token and private URL'),
      );
      await service.dispatch();
      const job = (await queue.getJob(`storage-delete-${id}`))!;
      await expect(job.waitUntilFinished(events, 25000)).rejects.toThrow(
        'Storage cleanup attempt failed',
      );
      const failed = (await queue.getJob(job.id!))!;
      expect(storage.deleteObject).toHaveBeenCalledTimes(
        STORAGE_CLEANUP_ATTEMPTS,
      );
      // Retrying a failed Bull job is NOT an authorized durable-state recovery action.
      await failed.retry('failed', { resetAttemptsMade: true });
      const forced = (await queue.getJob(failed.id!))!;
      await forced.waitUntilFinished(events, 10000);
      expect(storage.deleteObject).toHaveBeenCalledTimes(
        STORAGE_CLEANUP_ATTEMPTS,
      );
      expect(
        await source
          .getRepository(StorageDeletionIntentEntity)
          .findOneByOrFail({ id }),
      ).toMatchObject({
        state: 'failed',
        attempts: STORAGE_CLEANUP_ATTEMPTS,
        dlq_forwarded: false,
      });
      expect(JSON.stringify(failed.stacktrace)).not.toContain('secret');
      expect(
        await source
          .getRepository(StorageDeletionIntentEntity)
          .findOneByOrFail({ id }),
      ).toMatchObject({
        state: 'failed',
        attempts: STORAGE_CLEANUP_ATTEMPTS,
        dlq_forwarded: false,
      });

      const forward = jest
        .spyOn(queueService, 'deadLetter')
        .mockRejectedValueOnce(new Error('Redis unavailable'));
      await service.dispatch();
      expect(
        (
          await source
            .getRepository(StorageDeletionIntentEntity)
            .findOneByOrFail({ id })
        ).dlq_forwarded,
      ).toBe(false);
      await source.manager.update(
        StorageDeletionIntentEntity,
        { id },
        { available_at: new Date(0) },
      );
      await service.dispatch();
      expect(forward).toHaveBeenCalledTimes(2);
      const deadLetter = (await dlq.getJob(`storage-failure-${id}`))!;
      expect(deadLetter.data).toEqual({
        intentId: id,
        attempts: STORAGE_CLEANUP_ATTEMPTS,
        reason: 'Storage object deletion failed.',
      });
      expect(JSON.stringify(deadLetter.data)).not.toContain(
        'failed/object.png',
      );
      expect(
        (
          await source
            .getRepository(StorageDeletionIntentEntity)
            .findOneByOrFail({ id })
        ).dlq_forwarded,
      ).toBe(true);
      await service.dispatch();
      await service.deleteObject(id);
      expect(storage.deleteObject).toHaveBeenCalledTimes(
        STORAGE_CLEANUP_ATTEMPTS,
      );
    } finally {
      jest.restoreAllMocks();
      await worker.close();
      await events.close();
      await queue.obliterate();
      await dlq.obliterate();
      await queue.close();
      await dlq.close();
    }
  }, 35000);
});
