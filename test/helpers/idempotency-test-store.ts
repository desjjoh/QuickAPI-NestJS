import { IdempotencyEntity } from '@/modules/system/idempotency/entities/idempotency.entity';
import { IdempotencyRepository } from '@/modules/system/idempotency/repositories/idempotency.repository';

/** Transaction-local writes and connection-scoped locks, without a live MySQL server. */
export function idempotencyTestStore() {
  const rows = new Map<string, IdempotencyEntity>();
  const locks = new Set<string>();
  const connection = {};
  const runners: Array<{ released: boolean; destroyed: boolean }> = [];
  let failCommit = false;
  let failReleaseLock = false;
  const rootManager = {
    connection,
    delete: async () => {
      for (const [key, row] of rows)
        if (row.expires_at.getTime() <= Date.now()) rows.delete(key);
    },
  };
  const repository = {
    namespace: 'test',
    manager: rootManager,
    findByScope: async (
      manager: { staged: Map<string, IdempotencyEntity | null> },
      hash: string,
    ) =>
      manager.staged.has(hash)
        ? manager.staged.get(hash)
        : (rows.get(hash) ?? null),
    createQueryRunner: () => {
      const staged = new Map<string, IdempotencyEntity | null>();
      const state = { released: false, destroyed: false };
      runners.push(state);
      let held: string | undefined;
      const runner = {
        isTransactionActive: false,
        connect: async () => ({
          destroy: () => {
            state.destroyed = true;
            if (held) locks.delete(held);
          },
        }),
        query: async (sql: string, [hash]: string[]) => {
          if (sql.includes('GET_LOCK')) {
            if (locks.has(hash)) return [{ acquired: 0 }];
            locks.add(hash);
            held = hash;
            return [{ acquired: 1 }];
          }
          if (failReleaseLock) throw new Error('lock release failed');
          locks.delete(hash);
          return [{ released: 1 }];
        },
        release: async () => {
          state.released = true;
        },
        manager: {} as Record<string, unknown>,
      };
      const manager = {
        connection,
        queryRunner: runner,
        staged,
        transaction: async (work: (value: unknown) => Promise<unknown>) => {
          runner.isTransactionActive = true;
          try {
            const value = await work(manager);
            if (failCommit) throw new Error('commit failed');
            for (const [hash, row] of staged) {
              if (row) rows.set(hash, row);
              else rows.delete(hash);
            }
            return value;
          } finally {
            runner.isTransactionActive = false;
          }
        },
        insert: async (_entity: unknown, row: IdempotencyEntity) => {
          staged.set(row.scope_hash, { ...row });
        },
        update: async (
          _entity: unknown,
          criteria: { scope_hash: string },
          patch: Partial<IdempotencyEntity>,
        ) => {
          const row =
            staged.get(criteria.scope_hash) ?? rows.get(criteria.scope_hash);
          staged.set(criteria.scope_hash, {
            ...row,
            ...patch,
          } as IdempotencyEntity);
        },
        delete: async (_entity: unknown, criteria: { scope_hash: string }) => {
          staged.set(criteria.scope_hash, null);
        },
      };
      runner.manager = manager;
      return runner;
    },
  };
  return {
    rows,
    locks,
    runners,
    connection,
    repository: repository as unknown as IdempotencyRepository,
    setFailCommit: (value: boolean) => {
      failCommit = value;
    },
    setFailReleaseLock: (value: boolean) => {
      failReleaseLock = value;
    },
  };
}
