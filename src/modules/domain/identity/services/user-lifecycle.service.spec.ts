jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';
import { ROLE_KEYS } from '@/modules/domain/library/seeders/role.seeder';

import { UserEntity } from '../entities/user.entity';
import { UserProfileEntity } from '../entities/profile.entity';
import { UserLifecycleService } from './user-lifecycle.service';
import { TransactionLifecycle } from '@/common/helpers/transaction.helper';

describe('UserLifecycleService', () => {
  it('does not repeat cleanup or modify an existing tombstone', async () => {
    manager.findOneOrFail.mockResolvedValue({
      id: 'user-1',
      status: { key: 'deleted' },
    });
    await expect(
      service.deleteUser(
        { id: 'user-1' } as never,
        manager as never,
        new TransactionLifecycle(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.update).not.toHaveBeenCalled();
    expect(images.remove).not.toHaveBeenCalled();
  });
  const manager = {
    create: jest.fn(),
    save: jest.fn(),
    findOneOrFail: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
    transaction: jest.fn(),
  };
  const repository = { manager };
  const users = { findByEmail: jest.fn() };
  const references = {
    getAccountStatus: jest.fn(),
    getRole: jest.fn(),
  };
  const images = { remove: jest.fn() };
  const emails = { cancelForUser: jest.fn() };
  const idempotency = { eraseUserResponses: jest.fn() };
  const relations = { relation: jest.fn(), of: jest.fn(), remove: jest.fn() };
  let service: UserLifecycleService;

  beforeEach(() => {
    jest.clearAllMocks();
    images.remove.mockReset();
    users.findByEmail.mockResolvedValue(null);
    references.getAccountStatus.mockImplementation(async (key) => ({
      id: key,
    }));
    references.getRole.mockResolvedValue({ id: 'role-1', key: ROLE_KEYS.USER });
    manager.create.mockImplementation((_target, value) => value);
    manager.save.mockImplementation(async (_target, value) => ({
      ...value,
      id: 'user-1',
    }));
    manager.findOneOrFail.mockResolvedValue({ id: 'user-1' });
    relations.relation.mockReturnValue(relations);
    relations.of.mockReturnValue(relations);
    manager.createQueryBuilder.mockReturnValue(relations);
    service = new UserLifecycleService(
      users as never,
      repository as never,
      references as never,
      emails as never,
      idempotency as never,
      images as never,
    );
  });

  it('creates a user with the seeded status, role, and fresh metadata', async () => {
    await expect(
      service.createUser(
        { identity: { email: 'new@example.test', password: 'hash' } },
        manager as never,
      ),
    ).resolves.toEqual({ id: 'user-1' });

    expect(users.findByEmail).toHaveBeenCalledWith('new@example.test', manager);
    expect(references.getAccountStatus).toHaveBeenCalledWith(
      ACCOUNT_STATUS_KEYS.ACTIVE,
      manager,
    );
    expect(references.getRole).toHaveBeenCalledWith(ROLE_KEYS.USER, manager);
    expect(manager.create).toHaveBeenCalledWith(
      UserEntity,
      expect.objectContaining({
        status: { id: 'active' },
        roles: [{ id: 'role-1', key: ROLE_KEYS.USER }],
        metadata: expect.any(Object),
      }),
    );
    expect(manager.findOneOrFail).toHaveBeenCalledWith(UserEntity, {
      where: { id: 'user-1' },
    });
  });

  it('rejects creation without an email before querying persistence', async () => {
    await expect(service.createUser({})).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(users.findByEmail).not.toHaveBeenCalled();
  });

  it('rejects duplicate email creation before loading reference data', async () => {
    users.findByEmail.mockResolvedValue({ id: 'existing' });

    await expect(
      service.createUser({ identity: { email: 'taken@example.test' } }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(references.getAccountStatus).not.toHaveBeenCalled();
    expect(references.getRole).not.toHaveBeenCalled();
  });

  it.each([
    ['without an avatar', null, 0],
    ['with an avatar', { id: 'image-1' }, 1],
  ])(
    'soft deletes a user, removes email/avatar, and preserves historical profile fields %s',
    async (_case, avatar, imageRemovals) => {
      const user = {
        id: 'user-1',
        identity: { email: 'original@example.test' },
        profile: { id: 'profile-1', media: { avatar } },
      };
      const lifecycle = new TransactionLifecycle();
      manager.findOneOrFail.mockResolvedValue(user);

      await service.deleteUser(user as never, manager as never, lifecycle);

      expect(manager.remove).not.toHaveBeenCalled();
      expect(manager.delete).not.toHaveBeenCalledWith(
        UserProfileEntity,
        expect.anything(),
      );
      expect(manager.update).toHaveBeenCalledWith(
        UserEntity,
        { id: 'user-1' },
        expect.objectContaining({
          identity: {
            email: expect.stringMatching(/^deleted-[0-9a-f-]+@users\.invalid$/),
            password: null,
          },
          status: { id: 'deleted' },
          metadata: { deleted_at: expect.any(Date), mfa_enabled: false },
        }),
      );
      if (avatar) {
        expect(manager.update).toHaveBeenCalledWith(
          UserProfileEntity,
          { id: 'profile-1' },
          { media: { avatar: null } },
        );
        expect(images.remove).toHaveBeenCalledWith(avatar, manager, lifecycle);
      } else {
        expect(manager.update).not.toHaveBeenCalledWith(
          UserProfileEntity,
          expect.anything(),
          expect.anything(),
        );
      }
      expect(emails.cancelForUser).toHaveBeenCalledWith(
        'user-1',
        'original@example.test',
        manager,
      );
      expect(idempotency.eraseUserResponses).toHaveBeenCalledWith(
        'user-1',
        manager,
      );
      expect(images.remove).toHaveBeenCalledTimes(imageRemovals);
      expect(references.getAccountStatus).toHaveBeenCalledWith(
        'deleted',
        manager,
      );
    },
  );

  it('opens a transaction and forwards its manager and lifecycle when none is supplied', async () => {
    const transactionManager = { ...manager };
    const avatar = { id: 'image-1' };
    const user = {
      id: 'user-1',
      identity: { email: 'original@example.test' },
      profile: { id: 'profile-1', media: { avatar } },
    };
    manager.findOneOrFail.mockResolvedValue(user);
    manager.transaction.mockImplementation(async (work) =>
      work(transactionManager),
    );
    await service.deleteUser(user as never);

    expect(manager.transaction).toHaveBeenCalledTimes(1);
    expect(transactionManager.remove).not.toHaveBeenCalled();
    expect(transactionManager.update).toHaveBeenCalledWith(
      UserEntity,
      { id: 'user-1' },
      expect.objectContaining({
        metadata: { deleted_at: expect.any(Date), mfa_enabled: false },
      }),
    );
    expect(images.remove).toHaveBeenCalledWith(
      avatar,
      transactionManager,
      expect.any(TransactionLifecycle),
    );
  });
});
