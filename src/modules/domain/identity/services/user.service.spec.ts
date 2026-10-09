jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { NotFoundException } from '@nestjs/common';
import { TransactionLifecycle } from '@/common/helpers/transaction.helper';

import { UserEntity } from '../entities/user.entity';
import { UserService } from './user.service';

describe('UserService', () => {
  const user = {
    id: 'user-1',
    identity: { email: 'user@example.test', password: 'hash' },
    metadata: { last_updated_at: null },
  };
  const manager = {
    transaction: jest.fn(),
    create: jest.fn(),
    merge: jest.fn(),
    save: jest.fn(),
    findOneOrFail: jest.fn(),
  };
  const repository = {
    manager,
    paginate: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
  };
  let service: UserService;

  beforeEach(() => {
    jest.clearAllMocks();
    manager.transaction.mockImplementation(async (work) => work(manager));
    manager.create.mockImplementation((_target, value) => ({ ...value }));
    manager.merge.mockImplementation((_target, entity, value) => ({
      ...entity,
      ...value,
    }));
    manager.save.mockImplementation(async (_target, value) => value);
    manager.findOneOrFail.mockResolvedValue(user);
    repository.paginate.mockResolvedValue([[user], 1]);
    repository.findByEmail.mockResolvedValue(user);
    repository.findById.mockResolvedValue(user);
    service = new UserService(repository as never);
  });

  it('owns the transaction boundary', async () => {
    const work = jest.fn().mockResolvedValue('complete');

    await expect(service.transaction(work)).resolves.toBe('complete');

    expect(manager.transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(work).toHaveBeenCalledWith(
      manager,
      expect.any(TransactionLifecycle),
    );
  });

  it('delegates paginated, email, and id reads through the selected manager', async () => {
    const pageOptions = { page: 1, take: 20 };

    await expect(
      service.paginate(pageOptions as never, manager as never),
    ).resolves.toEqual([[user], 1]);
    await expect(
      service.findByEmail('user@example.test', manager as never),
    ).resolves.toBe(user);
    await expect(
      service.findByIdOrFail('user-1', manager as never),
    ).resolves.toBe(user);

    expect(repository.paginate).toHaveBeenCalledWith(manager, pageOptions);
    expect(repository.findByEmail).toHaveBeenCalledWith(
      manager,
      'user@example.test',
    );
    expect(repository.findById).toHaveBeenCalledWith(manager, 'user-1');
  });

  it('translates a missing id into a domain-facing not-found error', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findByIdOrFail('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a detached copy without mutating the caller', async () => {
    const original = structuredClone(user);

    await service.updateUser(
      user as never,
      { identity: { email: 'changed@example.test' } },
      {},
      manager as never,
    );

    expect(manager.create).toHaveBeenCalledWith(UserEntity, user);
    expect(manager.merge).toHaveBeenCalledWith(
      UserEntity,
      expect.not.objectContaining({
        identity: { email: 'changed@example.test' },
      }),
      expect.objectContaining({
        identity: { email: 'changed@example.test' },
        metadata: expect.objectContaining({
          last_updated_at: expect.any(Date),
        }),
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(UserEntity, expect.any(Object));
    expect(manager.findOneOrFail).toHaveBeenCalledWith(UserEntity, {
      where: { id: 'user-1' },
    });
    expect(user).toEqual(original);
  });

  it('supports preserving metadata timestamps for controlled updates', async () => {
    const lastUpdatedAt = new Date('2026-01-02T03:04:05.000Z');

    await service.updateUser(
      user as never,
      { metadata: { last_updated_at: lastUpdatedAt } },
      { touchLastUpdatedAt: false },
      manager as never,
    );

    expect(manager.merge).toHaveBeenCalledWith(UserEntity, expect.any(Object), {
      metadata: { last_updated_at: lastUpdatedAt },
    });
  });
});
