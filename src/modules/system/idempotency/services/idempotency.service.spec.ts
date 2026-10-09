import { ConflictException } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { idempotencyTestStore } from '../../../../../test/helpers/idempotency-test-store';
import { runInTransaction } from '@/common/helpers/transaction.helper';
import { logger } from '@/config/logger.config';

describe('durable request idempotency', () => {
  const scope = {
    actorId: 'actor-1',
    operation: 'create',
    route: 'POST /articles',
  };
  let store: ReturnType<typeof idempotencyTestStore>;
  let service: IdempotencyService;
  beforeEach(() => {
    store = idempotencyTestStore();
    service = new IdempotencyService(store.repository);
  });
  afterEach(() => {
    service.onModuleDestroy();
    jest.restoreAllMocks();
  });

  it('stores completion and identity and replays the original JSON response', async () => {
    const original = {
      id: 'article-1',
      version: 1,
      createdAt: new Date('2026-10-01'),
    };
    const work = jest.fn(async () => ({ status: 201, body: original }));
    const first = await service.execute(scope, 'key', 'fingerprint', work);
    Object.assign(original, { version: 9 });
    expect(await service.execute(scope, 'key', 'fingerprint', work)).toEqual(
      first,
    );
    expect(work).toHaveBeenCalledTimes(1);
    expect([...store.rows.values()][0]).toEqual(
      expect.objectContaining({
        state: 'completed',
        response_identity: 'article-1',
        response_status: 201,
      }),
    );
    expect(store.locks.size).toBe(0);
    expect(store.runners.every((runner) => runner.released)).toBe(true);
  });
  it('rejects changed payloads without executing again', async () => {
    const work = jest.fn(async () => ({
      status: 200,
      body: { id: 'article-1' },
    }));
    await service.execute(scope, 'key', 'original', work);
    await expect(
      service.execute(scope, 'key', 'changed', work),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(work).toHaveBeenCalledTimes(1);
  });
  it('rejects nested idempotent operations and rolls back the outer claim', async () => {
    const inner = jest.fn(async () => ({ status: 200, body: {} }));
    await expect(
      service.execute(scope, 'outer', 'fp', () =>
        service.execute(scope, 'inner', 'fp', inner),
      ),
    ).rejects.toThrow('cannot be nested');
    expect(inner).not.toHaveBeenCalled();
    expect(store.rows.size).toBe(0);
    expect(store.locks.size).toBe(0);
  });
  it.each(['actorId', 'operation', 'route'] as const)(
    'isolates keys by %s',
    async (field) => {
      const work = jest.fn(async () => ({ status: 200, body: {} }));
      await service.execute(scope, 'key', 'fingerprint', work);
      await service.execute(
        { ...scope, [field]: 'other' },
        'key',
        'fingerprint',
        work,
      );
      expect(work).toHaveBeenCalledTimes(2);
    },
  );
  it('prevents concurrent executions and permits replay after completion', async () => {
    let complete!: () => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const wait = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const work = jest.fn(async () => {
      started();
      await wait;
      return { status: 201, body: { id: 'article-1' } };
    });
    const first = service.execute(scope, 'key', 'fingerprint', work);
    await entered;
    await expect(
      service.execute(scope, 'key', 'fingerprint', work),
    ).rejects.toBeInstanceOf(ConflictException);
    complete();
    const response = await first;
    expect(await service.execute(scope, 'key', 'fingerprint', work)).toEqual(
      response,
    );
    expect(work).toHaveBeenCalledTimes(1);
  });
  it.each(['handler', 'commit'])(
    'rolls back the claim on %s failure and permits a safe retry',
    async (failure) => {
      store.setFailCommit(failure === 'commit');
      const work = jest.fn(async () => {
        if (failure === 'handler') throw new Error('handler failed');
        return { status: 200, body: {} };
      });
      await expect(service.execute(scope, 'key', 'fp', work)).rejects.toThrow(
        'failed',
      );
      expect(store.rows.size).toBe(0);
      expect(store.locks.size).toBe(0);
      store.setFailCommit(false);
      await expect(
        service.execute(scope, 'key', 'fp', async () => ({
          status: 201,
          body: {},
        })),
      ).resolves.toEqual({ status: 201, body: {} });
    },
  );
  it('reuses one manager and lifecycle and retains completion after a post-commit cleanup failure', async () => {
    const work = jest.fn(async () => {
      await runInTransaction(
        store.repository.manager,
        async (manager, lifecycle) => {
          expect(manager.queryRunner?.isTransactionActive).toBe(true);
          lifecycle.afterCommit(() => {
            throw new Error('storage cleanup failed');
          });
          return undefined;
        },
      );
      return { status: 201, body: { id: 'article-1' } };
    });
    await expect(service.execute(scope, 'key', 'fp', work)).rejects.toThrow(
      'storage cleanup failed',
    );
    expect(await service.execute(scope, 'key', 'fp', work)).toEqual({
      status: 201,
      body: { id: 'article-1' },
    });
    expect(work).toHaveBeenCalledTimes(1);
  });
  it('expires old records and sweeps stored responses', async () => {
    const work = jest.fn(async () => ({ status: 200, body: {} }));
    await service.execute(scope, 'key', 'fp', work);
    Object.assign([...store.rows.values()][0], { expires_at: new Date(0) });
    await service.execute(scope, 'key', 'changed', work);
    expect(work).toHaveBeenCalledTimes(2);
    Object.assign([...store.rows.values()][0], { expires_at: new Date(0) });
    await service.purgeExpired();
    expect(store.rows.size).toBe(0);
  });
  it('never retains a response body for a 204 completion', async () => {
    const work = jest.fn(async () => ({
      status: 204,
      body: { unnecessary: 'private data' },
    }));
    expect(await service.execute(scope, 'key', 'fp', work)).toEqual({
      status: 204,
      body: null,
    });
    expect(await service.execute(scope, 'key', 'fp', work)).toEqual({
      status: 204,
      body: null,
    });
    expect(work).toHaveBeenCalledTimes(1);
    expect([...store.rows.values()][0].response_body).toBeNull();
  });
  it('discards a connection if releasing its advisory lock fails', async () => {
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    store.setFailReleaseLock(true);
    await service.execute(scope, 'key', 'fp', async () => ({
      status: 201,
      body: {},
    }));
    expect(store.runners[0]).toEqual({ released: true, destroyed: true });
    expect(store.locks.size).toBe(0);
  });
});
