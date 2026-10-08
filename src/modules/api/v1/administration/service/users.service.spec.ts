import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  UserDto,
  type UserPaginationOptions,
} from '@/modules/domain/identity/models/user.model';
import { userFixture } from '@/../test/helpers/identity.fixtures';
import { ADMINISTRATION_REASON_CODES } from '@/config/administration.config';
import { UserAdminService } from './users.service';

describe('UserAdminService', () => {
  const setup = () => {
    const manager = {
      findOneOrFail: jest.fn().mockResolvedValue(userFixture()),
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const userSvc = {
      transaction: jest.fn(async (callback) => callback(manager)),
      paginate: jest.fn(),
      findByIdOrFail: jest.fn(),
      deleteUser: jest.fn(),
      updateAdministration: jest.fn(),
    };
    const context = {
      get: jest.fn((key: string) =>
        key === 'actorId' ? 'administrator-1' : 'operation-1',
      ),
    };

    return {
      manager,
      audit,
      userSvc,
      context,
      service: new UserAdminService(
        userSvc as never,
        userSvc as never,
        userSvc as never,
        audit as never,
        context as never,
      ),
    };
  };

  it('converts paginated entities to DTOs and calculates pagination metadata', async () => {
    const { userSvc, service } = setup();
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
    userSvc.paginate.mockResolvedValue([users, 5]);

    const result = await service.paginateUsers(pageOptions);

    expect(userSvc.paginate).toHaveBeenCalledTimes(1);
    expect(userSvc.paginate).toHaveBeenCalledWith(pageOptions);
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
    const { userSvc, service } = setup();
    const lastChangedMfa = new Date('2026-01-02T03:04:05.000Z');
    const user = userFixture({
      metadata: {
        ...userFixture().metadata,
        last_changed_mfa: lastChangedMfa,
      },
    });

    userSvc.findByIdOrFail.mockResolvedValue(user);

    const result = await service.findUser('user-1');

    expect(userSvc.findByIdOrFail).toHaveBeenCalledTimes(1);
    expect(userSvc.findByIdOrFail).toHaveBeenCalledWith('user-1');
    expect(result).toBeInstanceOf(UserDto);
    expect(result.id).toBe(user.id);
    expect(result.metadata.lastChangedMfa).toBe(lastChangedMfa.toISOString());
  });

  it('propagates repository not-found errors when finding a user', async () => {
    const { userSvc, service } = setup();
    const error = new NotFoundException('User not found.');
    userSvc.findByIdOrFail.mockRejectedValue(error);

    await expect(service.findUser('missing-user')).rejects.toBe(error);
  });

  it('delegates user removal exactly once with the requested id', async () => {
    const { userSvc, service, audit, manager } = setup();
    userSvc.deleteUser.mockResolvedValue(undefined);

    await expect(
      service.removeUser('user-1', {
        reason_code: ADMINISTRATION_REASON_CODES.POLICY_ENFORCEMENT,
      }),
    ).resolves.toBeUndefined();

    expect(userSvc.deleteUser).toHaveBeenCalledTimes(1);
    expect(userSvc.deleteUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      manager,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'identity.admin.user_deleted',
        actorType: 'admin',
        actorId: 'administrator-1',
        subjectId: 'user-1',
        resourceId: 'user-1',
        metadata: expect.objectContaining({
          reason_code: 'policy_enforcement',
        }),
        after: null,
      }),
      manager,
    );
    const input = audit.record.mock.calls[0][0];
    expect(input.actorId).toBe('administrator-1');
    expect(input.subjectId).toBe('user-1');
    expect(input.actorId).not.toBe(input.subjectId);
    expect(input).not.toHaveProperty('operationId');
    expect(input).not.toHaveProperty('idempotencyId');
    expect(input.metadata).not.toHaveProperty('operation_id');
  });

  it('delegates an administration update and converts the entity to a DTO', async () => {
    const { userSvc, service, audit, manager } = setup();
    const dto = {
      status_id: 'status-id-000001',
      role_ids: ['role-id-0000001'],
      reason_code: ADMINISTRATION_REASON_CODES.POLICY_ENFORCEMENT,
    };
    const user = userFixture({
      status: { key: 'disabled', label: 'Disabled' },
    });
    userSvc.updateAdministration.mockResolvedValue(user);

    const result = await service.updateUser('user-1', dto);

    expect(userSvc.updateAdministration).toHaveBeenCalledTimes(1);
    expect(userSvc.updateAdministration).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      dto,
      manager,
    );
    expect(result).toBeInstanceOf(UserDto);
    expect(result.status.key).toBe('disabled');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'identity.admin.user_updated',
        actorType: 'admin',
        actorId: 'administrator-1',
        subjectId: 'user-1',
        resourceId: 'user-1',
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
      const { userSvc, service, audit, manager } = setup();
      const before = userFixture({
        roles: beforeIds.map((id) => ({ id, key: id })),
      });
      const after = userFixture({
        roles: afterIds.map((id) => ({ id, key: id })),
      });
      manager.findOneOrFail.mockResolvedValue(before);
      userSvc.updateAdministration.mockResolvedValue(after);

      await service.updateUser('user-1', {
        role_ids: afterIds,
        reason_code: ADMINISTRATION_REASON_CODES.POLICY_ENFORCEMENT,
      });

      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'identity',
          event: 'identity.admin.user_updated',
          actorType: 'admin',
          actorId: 'administrator-1',
          subjectType: 'user',
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
    const { userSvc, service, audit, manager } = setup();
    manager.findOneOrFail.mockResolvedValue(userFixture({ roles: [] }));
    userSvc.updateAdministration.mockResolvedValue(
      userFixture({ roles: [{ id: 'role-1', key: 'role-1' }] }),
    );

    await service.updateUser('user-1', {
      role_ids: ['role-1', 'role-1'],
      reason_code: ADMINISTRATION_REASON_CODES.POLICY_ENFORCEMENT,
    });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({ roles: ['role-1'] }),
      }),
      manager,
    );
  });

  it('never reverses the administrator actor and affected-user subject', async () => {
    const { userSvc, service, audit } = setup();
    userSvc.updateAdministration.mockResolvedValue(userFixture());

    await service.updateUser('affected-user', {
      status_id: 'status-id-000001',
      reason_code: ADMINISTRATION_REASON_CODES.POLICY_ENFORCEMENT,
    });

    const input = audit.record.mock.calls[0][0];
    expect(input).toMatchObject({
      actorType: 'admin',
      actorId: 'administrator-1',
      subjectType: 'user',
      subjectId: 'affected-user',
      resourceType: 'identity.user',
      resourceId: 'affected-user',
      domain: 'identity',
      metadata: { reason_code: 'policy_enforcement' },
    });
    expect(input.actorId).not.toBe(input.subjectId);
  });

  it('rejects the role mutation transaction when its audit fails', async () => {
    const { userSvc, service, audit } = setup();
    userSvc.updateAdministration.mockResolvedValue(
      userFixture({ roles: [{ id: 'role-1', key: 'role-1' }] }),
    );
    audit.record.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      service.updateUser('user-1', {
        role_ids: ['role-1'],
        reason_code: ADMINISTRATION_REASON_CODES.POLICY_ENFORCEMENT,
      }),
    ).rejects.toThrow('audit unavailable');
    expect(userSvc.transaction).toHaveBeenCalledTimes(1);
  });

  it('propagates repository validation errors when updating a user', async () => {
    const { userSvc, service, audit } = setup();
    const dto = {
      role_ids: ['missing-role-id'],
      reason_code: ADMINISTRATION_REASON_CODES.POLICY_ENFORCEMENT,
    };
    const error = new BadRequestException('One or more roles were not found.');
    userSvc.updateAdministration.mockRejectedValue(error);

    await expect(service.updateUser('user-1', dto)).rejects.toBe(error);
    expect(userSvc.updateAdministration).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      dto,
      expect.any(Object),
    );
    expect(audit.record).not.toHaveBeenCalled();
  });
});
