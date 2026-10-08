import { BadRequestException } from '@nestjs/common';

import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';
import { AccountStatusEntity } from '@/modules/domain/library/entities/accountstatus.entity';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';
import { ROLE_KEYS } from '@/modules/domain/library/seeders/role.seeder';

import { UserEntity } from '../entities/user.entity';
import { UserAdministrationService } from './user-administration.service';

describe('UserAdministrationService', () => {
  const user = {
    id: 'user-1',
    roles: [{ id: 'old-role', key: 'old' }],
  };
  const relation = {
    of: jest.fn(),
    set: jest.fn(),
    addAndRemove: jest.fn(),
  };
  const query = { relation: jest.fn() };
  const manager = {
    findOneBy: jest.fn(),
    findBy: jest.fn(),
    findOneOrFail: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const repository = { manager };
  const users = { updateUser: jest.fn() };
  const references = {
    getAccountStatus: jest.fn(),
    getRole: jest.fn(),
  };
  const sessions = { incrementTokenVersion: jest.fn() };
  let service: UserAdministrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    users.updateUser.mockResolvedValue({ ...user, status: { id: 'active' } });
    references.getAccountStatus.mockResolvedValue({ id: 'active' });
    references.getRole.mockResolvedValue({
      id: 'new-role',
      key: ROLE_KEYS.USER,
    });
    manager.findOneBy.mockResolvedValue({ id: 'active' });
    manager.findBy.mockResolvedValue([{ id: 'new-role' }]);
    manager.findOneOrFail.mockResolvedValue(user);
    relation.of.mockReturnValue(relation);
    relation.set.mockResolvedValue(undefined);
    relation.addAndRemove.mockResolvedValue(undefined);
    query.relation.mockReturnValue(relation);
    manager.createQueryBuilder.mockReturnValue(query);
    service = new UserAdministrationService(
      users as never,
      repository as never,
      references as never,
      sessions as never,
    );
  });

  it('updates status by key and invalidates active session versions', async () => {
    await service.updateUserStatusByKey(
      user as never,
      ACCOUNT_STATUS_KEYS.ACTIVE,
      manager as never,
    );

    expect(references.getAccountStatus).toHaveBeenCalledWith(
      ACCOUNT_STATUS_KEYS.ACTIVE,
      manager,
    );
    expect(users.updateUser).toHaveBeenCalledWith(
      user,
      { status: { id: 'active' } },
      {},
      manager,
    );
    expect(sessions.incrementTokenVersion).toHaveBeenCalledWith(
      'user-1',
      manager,
    );
  });

  it('adds a seeded role without mutating the caller role array', async () => {
    const rolesBefore = [...user.roles];

    await service.addUserRoleByKey(
      user as never,
      ROLE_KEYS.USER,
      manager as never,
    );

    expect(users.updateUser).toHaveBeenCalledWith(
      user,
      {
        roles: [...rolesBefore, { id: 'new-role', key: ROLE_KEYS.USER }],
      },
      {},
      manager,
    );
    expect(user.roles).toEqual(rolesBefore);
  });

  it('returns the caller unchanged when it already has the role', async () => {
    const assigned = {
      ...user,
      roles: [{ id: 'new-role', key: ROLE_KEYS.USER }],
    };

    await expect(
      service.addUserRoleByKey(assigned as never, ROLE_KEYS.USER),
    ).resolves.toBe(assigned);
    expect(users.updateUser).not.toHaveBeenCalled();
  });

  it('rejects an unknown administrative status before changing relations', async () => {
    manager.findOneBy.mockResolvedValue(null);

    await expect(
      service.updateAdministration(user as never, { status_id: 'missing' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.findOneBy).toHaveBeenCalledWith(AccountStatusEntity, {
      id: 'missing',
    });
    expect(query.relation).not.toHaveBeenCalled();
  });

  it('rejects any missing role and leaves existing relations unchanged', async () => {
    manager.findBy.mockResolvedValue([{ id: 'role-1' }]);

    await expect(
      service.updateAdministration(user as never, {
        role_ids: ['role-1', 'missing'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.findBy).toHaveBeenCalledWith(RoleEntity, expect.any(Object));
    expect(query.relation).not.toHaveBeenCalled();
  });

  it('replaces status and role relations then reloads the complete user', async () => {
    await expect(
      service.updateAdministration(
        user as never,
        { status_id: 'active', role_ids: ['new-role', 'new-role'] },
        manager as never,
      ),
    ).resolves.toBe(user);

    expect(query.relation).toHaveBeenNthCalledWith(1, UserEntity, 'status');
    expect(query.relation).toHaveBeenNthCalledWith(2, UserEntity, 'roles');
    expect(relation.of).toHaveBeenCalledWith('user-1');
    expect(relation.set).toHaveBeenCalledWith('active');
    expect(relation.addAndRemove).toHaveBeenCalledWith(
      [{ id: 'new-role' }],
      user.roles,
    );
    expect(manager.findOneOrFail).toHaveBeenCalledWith(UserEntity, {
      where: { id: 'user-1' },
    });
  });
});
