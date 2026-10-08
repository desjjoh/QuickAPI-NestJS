jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';

import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';
import { ROLE_KEYS } from '@/modules/domain/library/seeders/role.seeder';

import { UserEntity } from '../entities/user.entity';
import { UserProfileEntity } from '../entities/profile.entity';
import { UserLifecycleService } from './user-lifecycle.service';

describe('UserLifecycleService', () => {
  const manager = {
    create: jest.fn(),
    save: jest.fn(),
    findOneOrFail: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
  };
  const repository = { manager };
  const users = { findByEmail: jest.fn() };
  const references = {
    getAccountStatus: jest.fn(),
    getRole: jest.fn(),
  };
  const images = { remove: jest.fn() };
  let service: UserLifecycleService;

  beforeEach(() => {
    jest.clearAllMocks();
    users.findByEmail.mockResolvedValue(null);
    references.getAccountStatus.mockResolvedValue({ id: 'active' });
    references.getRole.mockResolvedValue({ id: 'role-1', key: ROLE_KEYS.USER });
    manager.create.mockImplementation((_target, value) => value);
    manager.save.mockImplementation(async (_target, value) => ({
      ...value,
      id: 'user-1',
    }));
    manager.findOneOrFail.mockResolvedValue({ id: 'user-1' });
    service = new UserLifecycleService(
      users as never,
      repository as never,
      references as never,
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
  ])('deletes a user and profile %s', async (_case, avatar, imageRemovals) => {
    const user = {
      id: 'user-1',
      profile: { id: 'profile-1', media: { avatar } },
    };

    await service.deleteUser(user as never, manager as never);

    expect(manager.remove).toHaveBeenCalledWith(UserEntity, user);
    expect(manager.delete).toHaveBeenCalledWith(UserProfileEntity, {
      id: 'profile-1',
    });
    expect(images.remove).toHaveBeenCalledTimes(imageRemovals);
    if (avatar) expect(images.remove).toHaveBeenCalledWith(avatar, manager);
  });
});
