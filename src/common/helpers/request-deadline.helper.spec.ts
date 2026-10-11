import type { EntityManager } from 'typeorm';
import {
  RequestDeadline,
  assertRequestActive,
} from './request-deadline.helper';
import { runInTransaction } from './transaction.helper';

describe('request deadline transaction boundary', () => {
  it('does not acquire a transaction for already-expired work', async () => {
    const transaction = jest.fn();
    const manager = { transaction } as unknown as EntityManager;
    const deadline = new RequestDeadline(Date.now() - 1);
    await expect(
      deadline.run(() => runInTransaction(manager, async () => 'ok')),
    ).rejects.toThrow('deadline');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('allows compensating transactions after cancellation without reviving the request', async () => {
    const events: string[] = [];
    const manager = {
      transaction: async <T>(work: (manager: EntityManager) => Promise<T>) => {
        try {
          return await work({} as EntityManager);
        } finally {
          events.push('released');
        }
      },
    } as EntityManager;
    const deadline = new RequestDeadline(Date.now() + 10_000);
    await expect(
      deadline.run(() =>
        runInTransaction(manager, async (_tx, lifecycle) => {
          lifecycle.afterRollback(async () => {
            await runInTransaction(manager, async () => {
              events.push('compensated');
            });
          });
          deadline.expire();
          return 'not committed';
        }),
      ),
    ).rejects.toThrow('deadline');
    expect(events).toEqual(['released', 'compensated', 'released']);
    expect(() => deadline.run(assertRequestActive)).toThrow('deadline');
    expect(() => assertRequestActive()).not.toThrow();
  });
});
