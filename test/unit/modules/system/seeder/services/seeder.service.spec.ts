import { EntityManager } from 'typeorm';
import { logger } from '@/config/logger.config';
import type { Seeder } from '@/modules/system/seeder/types/seeder.types';
import { SeederService } from '@/modules/system/seeder/services/seeder.services';

describe('SeederService', () => {
  const manager = {} as EntityManager;
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs seeders sequentially in configured order', async () => {
    const debug = jest
      .spyOn(logger, 'debug')
      .mockImplementation(() => undefined);
    const calls: string[] = [];
    const make = (name: string, order: number): Seeder => ({
      name,
      order,
      run: jest.fn(async (receivedManager) => {
        expect(receivedManager).toBe(manager);
        calls.push(name);
        return { created: 1, skipped: 2 };
      }),
    });
    await new SeederService(
      manager,
      [make('third', 30), make('first', 10), make('second', 20)],
      'Test',
    ).run();
    expect(calls).toEqual(['first', 'second', 'third']);
    expect(debug).toHaveBeenCalledTimes(2);
    expect(debug).toHaveBeenNthCalledWith(
      1,
      'Running seeder group → Test (3 total)',
    );
    expect(debug).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(
        /^Seeder completed in \d+\.\d{2}ms — created=3 skipped=6$/,
      ),
    );
  });

  it('stops after a partial failure and propagates the same error', async () => {
    const failure = new Error('seed failed');
    const error = jest
      .spyOn(logger, 'error')
      .mockImplementation(() => undefined);
    const first = jest.fn().mockResolvedValue({ created: 1, skipped: 0 });
    const second = jest.fn().mockRejectedValue(failure);
    const third = jest.fn();
    const seeders = [
      { name: 'first', order: 1, run: first },
      { name: 'second', order: 2, run: second },
      { name: 'third', order: 3, run: third },
    ];
    await expect(
      new SeederService(manager, seeders, 'Test').run(),
    ).rejects.toBe(failure);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.any(Object),
      'Seeder failed → second',
    );
  });
});
