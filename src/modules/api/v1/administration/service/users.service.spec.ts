import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import {
  UserDto,
  type UserPaginationOptions,
} from '@/modules/domain/identity/models/user.model';
import { userFixture } from '@/../test/helpers/identity.fixtures';
import { UserAdminService } from './users.service';

describe('UserAdminService', () => {
  const setup = () => {
    const repo = {
      paginate: jest.fn(),
      findByIdOrFail: jest.fn(),
      removeUser: jest.fn(),
      updateUserAdministration: jest.fn(),
    };

    const manager = {
      findOneOrFail: jest.fn().mockResolvedValue(userFixture()),
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const auditRepository = { existsBy: jest.fn().mockResolvedValue(false) };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
      getRepository: jest.fn(() => auditRepository),
    };
    const context = { get: jest.fn().mockReturnValue('operation-1') };

    return {
      repo,
      manager,
      audit,
      auditRepository,
      dataSource,
      context,
      service: new UserAdminService(
        repo as unknown as UserRepository,
        dataSource as never,
        audit as never,
        context as never,
      ),
    };
  };

  it('converts paginated entities to DTOs and calculates pagination metadata', async () => {
    const { repo, service } = setup();
    const users = [
      userFixture(),
      userFixture({
        id: 'user-2',
        identity: { email: 'second@example.test', password: 'hash' },
      }),
    ];
    const pageOptions = {
      page: 2,
      take: 2,
      search: 'person',
      order: 'ASC',
      sort: 'user.createdAt',
      skip: 2,
    } as UserPaginationOptions;
    repo.paginate.mockResolvedValue([users, 5]);

    const result = await service.paginateUsers(pageOptions);

    expect(repo.paginate).toHaveBeenCalledTimes(1);
    expect(repo.paginate).toHaveBeenCalledWith(pageOptions);
    expect(result.data).toHaveLength(2);
    expect(result.data.every((user) => user instanceof UserDto)).toBe(true);
    expect(result.data.map((user) => user.id)).toEqual(['user-1', 'user-2']);
    expect(result.meta).toEqual({
      page: 2,
      take: 2,
      itemCount: 5,
      pageCount: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it('finds a user by id and converts the entity to a DTO', async () => {
    const { repo, service } = setup();
    const user = userFixture();
    repo.findByIdOrFail.mockResolvedValue(user);

    const result = await service.findUser('user-1');

    expect(repo.findByIdOrFail).toHaveBeenCalledTimes(1);
    expect(repo.findByIdOrFail).toHaveBeenCalledWith('user-1');
    expect(result).toBeInstanceOf(UserDto);
    expect(result.id).toBe(user.id);
  });

  it('propagates repository not-found errors when finding a user', async () => {
    const { repo, service } = setup();
    const error = new NotFoundException('User not found.');
    repo.findByIdOrFail.mockRejectedValue(error);

    await expect(service.findUser('missing-user')).rejects.toBe(error);
  });

  it('delegates user removal exactly once with the requested id', async () => {
    const { repo, service, audit, manager } = setup();
    repo.removeUser.mockResolvedValue(undefined);

    await expect(service.removeUser('user-1')).resolves.toBeUndefined();

    expect(repo.removeUser).toHaveBeenCalledTimes(1);
    expect(repo.removeUser).toHaveBeenCalledWith('user-1', expect.any(Object));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'identity.admin.user_deleted',
        actorType: 'admin',
        subjectId: 'user-1',
        resourceId: 'user-1',
        operationId: 'operation-1',
        idempotencyId: 'operation-1',
        after: null,
      }),
      manager,
    );
  });

  it('delegates an administration update and converts the entity to a DTO', async () => {
    const { repo, service, audit, manager } = setup();
    const dto = {
      status_id: 'status-id-000001',
      role_ids: ['role-id-0000001'],
    };
    const user = userFixture({
      status: { key: 'disabled', label: 'Disabled' },
    });
    repo.updateUserAdministration.mockResolvedValue(user);

    const result = await service.updateUser('user-1', dto);

    expect(repo.updateUserAdministration).toHaveBeenCalledTimes(1);
    expect(repo.updateUserAdministration).toHaveBeenCalledWith(
      'user-1',
      dto,
      expect.any(Object),
    );
    expect(result).toBeInstanceOf(UserDto);
    expect(result.status.key).toBe('disabled');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'identity.admin.user_updated',
        actorType: 'admin',
        subjectId: 'user-1',
        resourceId: 'user-1',
        operationId: 'operation-1',
        idempotencyId: 'operation-1',
        after: {
          id: user.id,
          status: { id: user.status.id },
          roles: [],
        },
      }),
      manager,
    );
  });

  it.each([
    ['grants', [], ['role-1']],
    ['removes', ['role-1'], []],
    ['replaces', ['role-1', 'role-2'], ['role-2', 'role-3']],
  ])(
    'records ID-only snapshots when an administrator %s user roles',
    async (_operation, beforeIds, afterIds) => {
      const { repo, service, audit, manager } = setup();
      const before = userFixture({
        roles: beforeIds.map((id) => ({ id, key: id })),
      });
      const after = userFixture({
        roles: afterIds.map((id) => ({ id, key: id })),
      });
      manager.findOneOrFail.mockResolvedValue(before);
      repo.updateUserAdministration.mockResolvedValue(after);

      await service.updateUser('user-1', { role_ids: afterIds });

      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'identity',
          event: 'identity.admin.user_updated',
          actorType: 'admin',
          subjectType: 'identity.user',
          subjectId: 'user-1',
          resourceType: 'identity.user',
          resourceId: 'user-1',
          before: expect.objectContaining({ roles: beforeIds }),
          after: expect.objectContaining({ roles: afterIds }),
        }),
        manager,
      );
    },
  );

  it('keeps duplicate role inputs out of the audit snapshots', async () => {
    const { repo, service, audit, manager } = setup();
    manager.findOneOrFail.mockResolvedValue(userFixture({ roles: [] }));
    repo.updateUserAdministration.mockResolvedValue(
      userFixture({ roles: [{ id: 'role-1', key: 'role-1' }] }),
    );

    await service.updateUser('user-1', {
      role_ids: ['role-1', 'role-1'],
    });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({ roles: ['role-1'] }),
      }),
      manager,
    );
  });

  it('rejects the role mutation transaction when its audit fails', async () => {
    const { repo, service, audit, dataSource } = setup();
    repo.updateUserAdministration.mockResolvedValue(
      userFixture({ roles: [{ id: 'role-1', key: 'role-1' }] }),
    );
    audit.record.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      service.updateUser('user-1', { role_ids: ['role-1'] }),
    ).rejects.toThrow('audit unavailable');
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('propagates repository validation errors when updating a user', async () => {
    const { repo, service, audit } = setup();
    const dto = { role_ids: ['missing-role-id'] };
    const error = new BadRequestException('One or more roles were not found.');
    repo.updateUserAdministration.mockRejectedValue(error);

    await expect(service.updateUser('user-1', dto)).rejects.toBe(error);
    expect(repo.updateUserAdministration).toHaveBeenCalledWith(
      'user-1',
      dto,
      expect.any(Object),
    );
    expect(audit.record).not.toHaveBeenCalled();
  });
});
