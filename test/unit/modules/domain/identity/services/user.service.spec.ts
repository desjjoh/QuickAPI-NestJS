import { repositoryFixture } from '@/../test/helpers/repository.fixture';
import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { NotFoundException } from '@nestjs/common';
import { TransactionLifecycle } from '@/common/helpers/transaction.helper';

import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserService } from '@/modules/domain/identity/services/user.service';

describe('UserService', () => {
  it('rejects a stale personal update after the account was tombstoned', async () => {
    manager.findOneOrFail.mockResolvedValue({
      ...user,
      status: { key: 'deleted' },
    });
    await expect(
      service.updateUser(user as never, {
        identity: { password: 'stale-hash' },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.save).not.toHaveBeenCalled();
  });
  const user = {
    id: 'user-1',
    administration_version: 1,
    identity: { email: 'user@example.test', password: 'hash' },
    metadata: { last_updated_at: null },
  };
  const manager = {
    transaction: jest.fn(),
    create: jest.fn(),
    merge: jest.fn(),
    save: jest.fn(),
    increment: jest.fn(),
    findOneOrFail: jest.fn(),
  };
  const repository = {
    manager,
    paginate: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findForUpdate: jest.fn(),
    findIncludingDeleted: jest.fn(),
  };
  let service: UserService;

  beforeEach(() => {
    jest.clearAllMocks();
    manager.increment.mockResolvedValue({ affected: 1 });
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
    service = new UserService(
      repositoryFixture(repository, UserRepository, UserEntity) as never,
    );
  });

  it('passes the explicit manager to locked and historical reads', async () => {
    const selected = {} as never;
    repository.findForUpdate.mockResolvedValue(user);
    repository.findIncludingDeleted.mockResolvedValue({
      ...user,
      status: { key: 'deleted' },
    });
    await expect(service.lockByIdOrFail(user.id, selected)).resolves.toBe(user);
    await expect(
      service.findIncludingDeletedOrFail(user.id, selected),
    ).resolves.toMatchObject({ status: { key: 'deleted' } });
    expect(repository.findForUpdate).toHaveBeenCalledWith(selected, user.id);
    expect(repository.findIncludingDeleted).toHaveBeenCalledWith(
      selected,
      user.id,
    );
  });

  it('rejects missing or deleted users on normal locked reads', async () => {
    for (const value of [null, { ...user, status: { key: 'deleted' } }]) {
      repository.findForUpdate.mockResolvedValue(value);
      await expect(service.lockByIdOrFail(user.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    }
    repository.findIncludingDeleted.mockResolvedValue(null);
    await expect(
      service.findIncludingDeletedOrFail(user.id),
    ).rejects.toBeInstanceOf(NotFoundException);
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

  it('never saves a caller-supplied revision or unrelated stale administration fields', async () => {
    const stale = {
      ...user,
      status: { id: 'old-status' },
      roles: [{ id: 'old-role' }],
    };
    await service.updateUser(
      stale as never,
      {
        identity: { email: 'changed@example.test' },
        administration_version: 99,
      },
      {},
      manager as never,
    );
    const saved = manager.save.mock.calls[0][1];
    expect(saved).not.toHaveProperty('administration_version');
    expect(saved).not.toHaveProperty('status');
    expect(saved).not.toHaveProperty('roles');
    expect(manager.increment).not.toHaveBeenCalled();
    expect(stale.administration_version).toBe(1);
  });

  it.each([{ status: { id: 'disabled' } }, { roles: [] }])(
    'advances administration revision for another status/role write',
    async (dto) => {
      await service.updateUser(user as never, dto, {}, manager as never);
      expect(manager.increment).toHaveBeenCalledWith(
        UserEntity,
        { id: 'user-1' },
        'administration_version',
        1,
      );
      expect(manager.transaction).toHaveBeenCalledTimes(1);
    },
  );
});
