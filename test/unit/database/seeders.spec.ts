import { DataSource, EntityManager } from 'typeorm';
import { runSeedCommand, seedDatabase } from '@/database/seeders';

describe('database seed runner', () => {
  it('uses one transaction across groups and stops on failure', async () => {
    const failure = new Error('failed seed');
    const manager = {} as EntityManager;
    const transaction = jest.fn(
      async (work: (manager: EntityManager) => Promise<void>) => work(manager),
    );
    const first = jest.fn().mockResolvedValue({ created: 1, skipped: 0 });
    const second = jest.fn().mockRejectedValue(failure);
    const third = jest.fn();

    await expect(
      seedDatabase({ transaction } as unknown as DataSource, [
        { name: 'First', seeders: [{ name: 'first', order: 1, run: first }] },
        {
          name: 'Second',
          seeders: [{ name: 'second', order: 1, run: second }],
        },
        { name: 'Third', seeders: [{ name: 'third', order: 1, run: third }] },
      ]),
    ).rejects.toBe(failure);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith(manager);
    expect(third).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'closes the connection after seeding (failure=%s)',
    async (fail) => {
      const failure = new Error('transaction failed');
      const destroy = jest.fn().mockResolvedValue(undefined);
      const source = {
        isInitialized: true,
        initialize: jest.fn().mockResolvedValue(undefined),
        transaction: fail
          ? jest.fn().mockRejectedValue(failure)
          : jest.fn().mockResolvedValue(undefined),
        destroy,
      } as unknown as DataSource;

      if (fail) await expect(runSeedCommand(source)).rejects.toBe(failure);
      else await runSeedCommand(source);

      expect(destroy).toHaveBeenCalledTimes(1);
    },
  );

  it('propagates connection failures without destroying an uninitialized source', async () => {
    const failure = new Error('connection refused');
    const destroy = jest.fn();
    const source = {
      isInitialized: false,
      initialize: jest.fn().mockRejectedValue(failure),
      destroy,
    } as unknown as DataSource;

    await expect(runSeedCommand(source)).rejects.toBe(failure);
    expect(destroy).not.toHaveBeenCalled();
  });
});
