import { ConflictException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { DataSource } from 'typeorm';
import { runInTransaction } from '@/common/helpers/transaction.helper';
import { idempotencyPolicy } from '@/config/idempotency.config';
import { ImageEntity } from '@/modules/domain/media/entities/image.entity';
import { IdempotencyEntity } from '@/modules/system/idempotency/entities/idempotency.entity';
import { IdempotencyRepository } from '@/modules/system/idempotency/repositories/idempotency.repository';
import { IdempotencyService } from '@/modules/system/idempotency/services/idempotency.service';
import {
  closeTestDataSource,
  initializeTestDataSource,
  resetMutableTables,
} from '../../helpers/database/test-database';

describe('request idempotency (disposable MySQL)', () => {
  let source: DataSource;
  let service: IdempotencyService;
  const scope = {
    actorId: 'test-actor',
    operation: 'test.create',
    route: 'POST /test',
  };

  beforeAll(async () => {
    source = await initializeTestDataSource();
    service = new IdempotencyService(new IdempotencyRepository(source));
  });
  beforeEach(async () => {
    await resetMutableTables(source);
  });
  afterAll(async () => {
    if (source) await closeTestDataSource(source);
  });

  const createImage = () =>
    runInTransaction(source.manager, async (manager) => {
      const image = await manager.save(
        ImageEntity,
        manager.create(ImageEntity, {
          storage_key: 'test/image.png',
          filename: 'image.png',
          mime_type: 'image/png',
          size_bytes: 1,
          width: 1,
          height: 1,
        }),
      );
      return { status: 201, body: { id: image.id } };
    });

  it('coordinates separate connections and replays one durable mutation', async () => {
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const work = jest.fn(async () => {
      entered();
      await pending;
      return createImage();
    });
    const first = service.execute(scope, 'concurrent', 'fp', work);
    await started;
    try {
      const secondInstance = new IdempotencyService(
        new IdempotencyRepository(source),
      );
      await expect(
        secondInstance.execute(scope, 'concurrent', 'fp', work),
      ).rejects.toBeInstanceOf(ConflictException);
    } finally {
      release();
    }
    const original = await first;
    expect(await service.execute(scope, 'concurrent', 'fp', work)).toEqual(
      original,
    );
    await expect(
      service.execute(scope, 'concurrent', 'different', work),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(work).toHaveBeenCalledTimes(1);
    expect(await source.getRepository(ImageEntity).count()).toBe(1);
    expect(await source.getRepository(IdempotencyEntity).count()).toBe(1);
  });

  it('rolls back both the mutation and claim, releases its lock, and permits retry', async () => {
    await expect(
      service.execute(scope, 'rollback', 'fp', async () => {
        await createImage();
        throw new Error('failed after mutation');
      }),
    ).rejects.toThrow('failed after mutation');
    expect(await source.getRepository(ImageEntity).count()).toBe(0);
    expect(await source.getRepository(IdempotencyEntity).count()).toBe(0);
    await service.execute(scope, 'rollback', 'fp', createImage);
    expect(await source.getRepository(ImageEntity).count()).toBe(1);
  });

  it('stores bodyless 204 completion and replays without executing again', async () => {
    const work = jest.fn(async () => ({ status: 204, body: undefined }));
    const original = await service.execute(scope, 'no-content', 'fp', work);
    expect(original).toEqual({ status: 204, body: null });
    expect(await service.execute(scope, 'no-content', 'fp', work)).toEqual(
      original,
    );
    expect(work).toHaveBeenCalledTimes(1);
    expect(
      await source
        .getRepository(IdempotencyEntity)
        .findOneByOrFail({ actor_id: scope.actorId }),
    ).toMatchObject({ response_status: 204, response_body: null });
  });

  it('expires snapshots without extending retention on replay and sweeps only expired records', async () => {
    const work = jest.fn(async () => ({
      status: 200,
      body: { id: 'user', profile: { contact: { phone: 'private phone' } } },
    }));
    const before = Date.now();
    await service.execute(scope, 'private-key', 'opaque-fingerprint', work);
    const records = source.getRepository(IdempotencyEntity);
    const row = await records.findOneByOrFail({ actor_id: scope.actorId });
    expect(row.expires_at.getTime()).toBeGreaterThanOrEqual(
      before + idempotencyPolicy.retentionMs - 1,
    );
    expect(row.expires_at.getTime()).toBeLessThanOrEqual(
      Date.now() + idempotencyPolicy.retentionMs,
    );
    expect(JSON.stringify(row)).not.toContain('private-key');
    await service.execute(scope, 'private-key', 'opaque-fingerprint', work);
    expect(
      (await records.findOneByOrFail({ scope_hash: row.scope_hash }))
        .expires_at,
    ).toEqual(row.expires_at);
    await records.update(
      { scope_hash: row.scope_hash },
      { expires_at: new Date(0) },
    );
    await service.execute(scope, 'retained', 'fp', work);
    await service.purgeExpired();
    expect(await records.count()).toBe(1);
    expect(await records.findOneBy({ scope_hash: row.scope_hash })).toBeNull();
    await service.execute(scope, 'private-key', 'changed-after-expiry', work);
    expect(work).toHaveBeenCalledTimes(3);
  });
});
