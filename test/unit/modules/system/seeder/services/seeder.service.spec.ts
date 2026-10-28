import { DataSource } from 'typeorm';
import { env } from '@/config/environment.config';
import { logger } from '@/config/logger.config';
import type { Seeder } from '@/modules/system/seeder/types/seeder.types';
import { SeederService } from '@/modules/system/seeder/services/seeder.services';
import { Test } from '@nestjs/testing';
import { SeedingModule } from '@/modules/system/seeder/seeder.module';

describe('SeederService', () => {
  const original = env.DB_SEED;
  const manager = {};
  const dataSource = { manager } as DataSource;
  afterEach(() => {
    Object.assign(env, { DB_SEED: original });
    jest.restoreAllMocks();
  });

  it('does nothing when seeding is disabled', async () => {
    Object.assign(env, { DB_SEED: false });
    const run = jest.fn();
    await new SeederService(
      dataSource,
      [{ name: 'disabled', order: 1, run }],
      'Test',
    ).onApplicationBootstrap();
    expect(run).not.toHaveBeenCalled();
  });

  it('runs seeders sequentially in configured order', async () => {
    Object.assign(env, { DB_SEED: true });
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
      dataSource,
      [make('third', 30), make('first', 10), make('second', 20)],
      'Test',
    ).onApplicationBootstrap();
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
    Object.assign(env, { DB_SEED: true });
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
      new SeederService(dataSource, seeders, 'Test').onApplicationBootstrap(),
    ).rejects.toBe(failure);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.any(Object),
      'Seeder failed → second',
    );
  });

  it('injects the group registered by the owning module', async () => {
    Object.assign(env, { DB_SEED: true });
    const debug = jest
      .spyOn(logger, 'debug')
      .mockImplementation(() => undefined);
    const registration = SeedingModule.forFeature('Library', [
      {
        name: 'CountrySeeder',
        order: 1,
        run: jest.fn().mockResolvedValue({ created: 0, skipped: 1 }),
      },
    ]);
    const module = await Test.createTestingModule({
      providers: [
        ...(registration.providers ?? []),
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    try {
      await module.get(SeederService).onApplicationBootstrap();
      expect(debug).toHaveBeenCalledWith(
        'Running seeder group → Library (1 total)',
      );
    } finally {
      await module.close();
    }
  });
});
