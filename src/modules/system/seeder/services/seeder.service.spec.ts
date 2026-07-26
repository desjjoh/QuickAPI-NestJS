import { DataSource } from 'typeorm';
import { env } from '@/config/environment.config';
import type { Seeder } from '../types/seeder.types';
import { SeederService } from './seeder.services';

describe('SeederService', () => {
  const original = env.DB_SEED;
  const dataSource = {} as DataSource;
  afterEach(() => {
    Object.assign(env, { DB_SEED: original });
    jest.restoreAllMocks();
  });

  it('does nothing when seeding is disabled', async () => {
    Object.assign(env, { DB_SEED: false });
    const run = jest.fn();
    await new SeederService(dataSource, [
      { name: 'disabled', order: 1, run },
    ]).onApplicationBootstrap();
    expect(run).not.toHaveBeenCalled();
  });

  it('runs seeders sequentially in configured order', async () => {
    Object.assign(env, { DB_SEED: true });
    const calls: string[] = [];
    const make = (name: string, order: number): Seeder => ({
      name,
      order,
      run: jest.fn(async (ds) => {
        expect(ds).toBe(dataSource);
        calls.push(name);
        return { created: 1, skipped: 2 };
      }),
    });
    await new SeederService(dataSource, [
      make('third', 30),
      make('first', 10),
      make('second', 20),
    ]).onApplicationBootstrap();
    expect(calls).toEqual(['first', 'second', 'third']);
  });

  it('stops after a partial failure and propagates the same error', async () => {
    Object.assign(env, { DB_SEED: true });
    const failure = new Error('seed failed');
    const first = jest.fn().mockResolvedValue({ created: 1, skipped: 0 });
    const second = jest.fn().mockRejectedValue(failure);
    const third = jest.fn();
    const seeders = [
      { name: 'first', order: 1, run: first },
      { name: 'second', order: 2, run: second },
      { name: 'third', order: 3, run: third },
    ];
    await expect(
      new SeederService(dataSource, seeders).onApplicationBootstrap(),
    ).rejects.toBe(failure);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).not.toHaveBeenCalled();
  });
});
