import { StorageObjectService } from '@/modules/system/storage/services/storage-object.service';
import { StorageObjectEntity } from '@/modules/system/storage/entities/storage-object.entity';
import {
  TransactionLifecycle,
  withApplicationTransaction,
} from '@/common/helpers/transaction.helper';

describe('StorageObjectService', () => {
  const setup = () => {
    const transaction = {
      queryRunner: { isTransactionActive: true },
      update: jest.fn(),
    };
    const root = {
      insert: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn((work) => work(transaction)),
    };
    const repository = {
      reservationManager: jest.fn(async () => root),
      findLocked: jest.fn().mockResolvedValue({ state: 'uploaded' }),
    };
    const service = new StorageObjectService(repository as never);
    return { service, repository, root, transaction };
  };
  it('commits unique reservations independently of an active request transaction', async () => {
    const { service, root } = setup();
    const outer = { insert: jest.fn() };
    const keys = await withApplicationTransaction(
      outer as never,
      new TransactionLifecycle(),
      () =>
        Promise.all([
          service.reserve('heroes', '.png'),
          service.reserve('heroes', '.png'),
        ]),
    );
    expect(keys[0].storage_key).not.toBe(keys[1].storage_key);
    expect(keys[0].filename).toMatch(/^[a-f0-9-]{36}\.png$/);
    expect(root.insert).toHaveBeenCalledTimes(2);
    expect(outer.insert).not.toHaveBeenCalled();
    expect(root.insert).toHaveBeenCalledWith(
      StorageObjectEntity,
      expect.objectContaining({ state: 'reserved' }),
    );
  });
  it.each(['../escape', '/root', 'trailing/', 'a//b'])(
    'rejects invalid managed folders %s before reservation',
    async (folder) => {
      const { service, root } = setup();
      await expect(service.reserve(folder, '.png')).rejects.toThrow(
        'Invalid managed storage',
      );
      expect(root.insert).not.toHaveBeenCalled();
    },
  );
  it.each(['reserved', 'attached', 'deleting', 'deleted', null])(
    'rejects attachment from state %s',
    async (state) => {
      const { service, repository, transaction } = setup();
      repository.findLocked.mockResolvedValue(state ? { state } : null);
      await expect(service.attach(transaction as never, 'key')).rejects.toThrow(
        'cannot be attached',
      );
      expect(transaction.update).not.toHaveBeenCalled();
    },
  );
  it('attaches the uploaded key in the originating transaction', async () => {
    const { service, transaction } = setup();
    await service.attach(transaction as never, 'key');
    expect(transaction.update).toHaveBeenCalledWith(
      StorageObjectEntity,
      { storage_key: 'key' },
      { state: 'attached', expires_at: null },
    );
  });
  it('locks ownership across the active PUT and marks it uploaded only after success', async () => {
    const { service, repository, transaction } = setup();
    repository.findLocked.mockResolvedValue({ state: 'reserved' });
    const work = jest.fn();
    await service.upload('key', work);
    expect(work).toHaveBeenCalledTimes(1);
    expect(transaction.update).toHaveBeenCalledWith(
      StorageObjectEntity,
      { storage_key: 'key' },
      expect.objectContaining({ state: 'uploaded' }),
    );
  });
  it('does not start PUT after reconciliation has fenced the reservation', async () => {
    const { service, repository } = setup();
    repository.findLocked.mockResolvedValue({ state: 'deleting' });
    const work = jest.fn();
    await expect(service.upload('key', work)).rejects.toThrow(
      'reservation is no longer available',
    );
    expect(work).not.toHaveBeenCalled();
  });
  it('does not claim success when PUT fails', async () => {
    const { service, repository, transaction } = setup();
    repository.findLocked.mockResolvedValue({ state: 'reserved' });
    await expect(
      service.upload('key', async () => {
        throw new Error('PUT uncertain');
      }),
    ).rejects.toThrow('PUT uncertain');
    expect(transaction.update).not.toHaveBeenCalled();
  });
  it('only expires unattached reservations during abandonment, never reviving tombstones', async () => {
    const { service, root } = setup();
    await service.abandon('key');
    expect(root.update.mock.calls.map((call) => call[1])).toEqual([
      { storage_key: 'key', state: 'uploaded' },
      { storage_key: 'key', state: 'reserved' },
    ]);
  });
});
