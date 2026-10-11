import { DataSource } from 'typeorm';
import { StorageObjectRepository } from './storage-object.repository';
import { StorageObjectEntity } from '../entities/storage-object.entity';

describe('StorageObjectRepository', () => {
  afterEach(() => jest.restoreAllMocks());
  it('uses one independent lazy reservation pool and closes it at shutdown', async () => {
    const initialize = jest
      .spyOn(DataSource.prototype, 'initialize')
      .mockImplementation(async function (this: DataSource) {
        return this;
      });
    const destroy = jest
      .spyOn(DataSource.prototype, 'destroy')
      .mockResolvedValue(undefined);
    const main = new DataSource({
      type: 'mysql',
      database: 'disposable',
      extra: { connectionLimit: 1 },
    });
    const repository = new StorageObjectRepository(main);
    const [first, second] = await Promise.all([
      repository.reservationManager(),
      repository.reservationManager(),
    ]);
    expect(first).toBe(second);
    expect(first).not.toBe(main.manager);
    expect(first.connection.options).toMatchObject({
      synchronize: false,
      migrationsRun: false,
      migrations: [],
      entities: [StorageObjectEntity],
      extra: { connectionLimit: 2 },
    });
    expect(initialize).toHaveBeenCalledTimes(1);
    await repository.onModuleDestroy();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
  it('can retry initialization after a failed connection', async () => {
    const initialize = jest
      .spyOn(DataSource.prototype, 'initialize')
      .mockRejectedValueOnce(new Error('DB down'))
      .mockImplementation(async function (this: DataSource) {
        return this;
      });
    jest.spyOn(DataSource.prototype, 'destroy').mockResolvedValue(undefined);
    const main = new DataSource({ type: 'mysql' });
    const repository = new StorageObjectRepository(main);
    await expect(repository.reservationManager()).rejects.toThrow('DB down');
    await repository.reservationManager();
    expect(initialize).toHaveBeenCalledTimes(2);
    await repository.onModuleDestroy();
  });
  it('reads expired unattached objects in bounded batches without waiting for active upload locks', async () => {
    const query = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      setOnLocked: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn(() => ({ createQueryBuilder: () => query })),
    };
    await new StorageObjectRepository({} as never).findAbandoned(
      manager as never,
    );
    expect(manager.getRepository).toHaveBeenCalledWith(StorageObjectEntity);
    expect(query.where).toHaveBeenCalledWith('object.state IN (:...states)', {
      states: ['reserved', 'uploaded', 'deleted'],
    });
    expect(query.andWhere).toHaveBeenCalledWith('object.expires_at <= :now', {
      now: expect.any(Date),
    });
    expect(query.take).toHaveBeenCalledWith(20);
    expect(query.setOnLocked).toHaveBeenCalledWith('skip_locked');
  });
});
