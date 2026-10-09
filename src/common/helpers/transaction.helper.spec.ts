import type { EntityManager } from 'typeorm';

import {
  runInTransaction,
  TransactionLifecycle,
  withApplicationTransaction,
  hasApplicationTransaction,
  applicationManager,
  afterApplicationTransaction,
} from './transaction.helper';

describe('transaction helpers', () => {
  it.each([false, true])(
    'persists independent accounting after connection release (rollback=%s)',
    async (fail) => {
      const events: string[] = [];
      const tx = {} as EntityManager;
      const root = {
        transaction: async (work) => {
          try {
            return await work(tx);
          } finally {
            events.push('released');
          }
        },
      } as EntityManager;
      const accounting = jest.fn(() => {
        events.push('accounting');
      });
      const result = runInTransaction(root, async () => {
        expect(applicationManager(root)).toBe(tx);
        await afterApplicationTransaction(accounting);
        expect(accounting).not.toHaveBeenCalled();
        if (fail) throw new Error('unauthorized');
        return 'ok';
      });
      if (fail) await expect(result).rejects.toThrow('unauthorized');
      else await expect(result).resolves.toBe('ok');
      expect(events).toEqual(['released', 'accounting']);
      expect(accounting).toHaveBeenCalledTimes(1);
      expect(applicationManager(root)).toBe(root);
    },
  );

  it('executes independent accounting immediately outside application transactions', async () => {
    const accounting = jest.fn();
    await afterApplicationTransaction(accounting);
    expect(accounting).toHaveBeenCalledTimes(1);
  });
  it('shares the application manager and lifecycle without opening another transaction', async () => {
    const connection = {};
    const manager = {
      connection,
      transaction: jest.fn(),
    } as unknown as EntityManager;
    const outer = {
      connection,
      queryRunner: { isTransactionActive: true },
    } as unknown as EntityManager;
    const lifecycle = new TransactionLifecycle();
    const cleanup = jest.fn();

    await withApplicationTransaction(outer, lifecycle, async () => {
      expect(hasApplicationTransaction()).toBe(true);
      await runInTransaction(manager, async (current, hooks) => {
        expect(current).toBe(outer);
        expect(hooks).toBe(lifecycle);
        hooks.afterCommit(cleanup);
      });
      expect(cleanup).not.toHaveBeenCalled();
    });
    expect(hasApplicationTransaction()).toBe(false);
    expect(manager.transaction).not.toHaveBeenCalled();
    await lifecycle.commit();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'rejects unsafe application transaction reuse (inactive: %s)',
    async (inactive) => {
      const manager = { connection: {} } as unknown as EntityManager;
      const outer = {
        connection: {},
        queryRunner: { isTransactionActive: !inactive },
      } as unknown as EntityManager;
      const work = jest.fn();
      await expect(
        withApplicationTransaction(outer, new TransactionLifecycle(), () =>
          runInTransaction(manager, work),
        ),
      ).rejects.toThrow(
        inactive ? 'no longer active' : 'different data sources',
      );
      expect(work).not.toHaveBeenCalled();
      expect(hasApplicationTransaction()).toBe(false);
    },
  );

  it('rejects nested lifecycles before a savepoint can trigger premature cleanup', async () => {
    const manager = {
      queryRunner: { isTransactionActive: true },
      transaction: jest.fn(),
    } as unknown as EntityManager;
    const work = jest.fn();

    await expect(runInTransaction(manager, work)).rejects.toThrow(
      'Reuse the outer transaction manager and lifecycle',
    );
    expect(work).not.toHaveBeenCalled();
    expect(manager.transaction).not.toHaveBeenCalled();
  });

  it('compensates uploads when the database commit itself fails', async () => {
    const failure = new Error('commit failed');
    const cleanup = jest.fn();
    const manager = {
      transaction: jest.fn(async (work) => {
        await work({} as EntityManager);
        throw failure;
      }),
    } as unknown as EntityManager;

    await expect(
      runInTransaction(manager, async (_current, lifecycle) => {
        lifecycle.afterRollback(cleanup);
        return 'done';
      }),
    ).rejects.toBe(failure);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('never compensates committed data when a post-commit action fails', async () => {
    const failure = new Error('cleanup failed');
    const rollback = jest.fn();
    const subsequentCleanup = jest.fn();
    const manager = {
      transaction: jest.fn(async (work) => work({} as EntityManager)),
    } as unknown as EntityManager;

    await expect(
      runInTransaction(manager, async (_current, lifecycle) => {
        lifecycle.afterRollback(rollback);
        lifecycle.afterCommit(() => {
          throw failure;
        });
        lifecycle.afterCommit(subsequentCleanup);
        return 'done';
      }),
    ).rejects.toBe(failure);
    expect(rollback).not.toHaveBeenCalled();
    expect(subsequentCleanup).toHaveBeenCalledTimes(1);
  });

  it('runs commit actions only after the database transaction commits', async () => {
    const events: string[] = [];
    const transactionManager = {} as EntityManager;
    const manager = {
      transaction: jest.fn(async (work) => {
        events.push('database:start');
        const result = await work(transactionManager);
        events.push('database:commit');
        return result;
      }),
    } as unknown as EntityManager;

    await expect(
      runInTransaction(manager, async (current, lifecycle) => {
        expect(current).toBe(transactionManager);
        lifecycle.afterCommit(() => {
          events.push('storage:commit');
        });
        lifecycle.afterRollback(() => {
          events.push('storage:rollback');
        });
        events.push('work');
        return 'done';
      }),
    ).resolves.toBe('done');

    expect(events).toEqual([
      'database:start',
      'work',
      'database:commit',
      'storage:commit',
    ]);
  });

  it('runs rollback actions in reverse order when database work fails', async () => {
    const events: string[] = [];
    const failure = new Error('database failed');
    const manager = {
      transaction: jest.fn(async (work) => work({} as EntityManager)),
    } as unknown as EntityManager;

    await expect(
      runInTransaction(manager, async (_current, lifecycle) => {
        lifecycle.afterRollback(() => {
          events.push('first');
        });
        lifecycle.afterRollback(() => {
          events.push('second');
        });
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(events).toEqual(['second', 'first']);
  });

  it('supports cancelling a lifecycle action', async () => {
    const lifecycle = new TransactionLifecycle();
    const action = jest.fn();
    const cancel = lifecycle.afterRollback(action);

    cancel();
    await lifecycle.rollback();

    expect(action).not.toHaveBeenCalled();
  });

  it('reports both the transaction and rollback cleanup failures', async () => {
    const transactionFailure = new Error('database failed');
    const cleanupFailure = new Error('cleanup failed');
    const manager = {
      transaction: jest.fn(async (work) => work({} as EntityManager)),
    } as unknown as EntityManager;

    const result = runInTransaction(manager, async (_current, lifecycle) => {
      lifecycle.afterRollback(() => {
        throw cleanupFailure;
      });
      throw transactionFailure;
    });

    await expect(result).rejects.toEqual(
      expect.objectContaining({
        name: 'AggregateError',
        errors: [transactionFailure, cleanupFailure],
      }),
    );
  });
});
