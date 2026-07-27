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

    return {
      repo,
      service: new UserAdminService(repo as unknown as UserRepository),
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
    const { repo, service } = setup();
    repo.removeUser.mockResolvedValue(undefined);

    await expect(service.removeUser('user-1')).resolves.toBeUndefined();

    expect(repo.removeUser).toHaveBeenCalledTimes(1);
    expect(repo.removeUser).toHaveBeenCalledWith('user-1');
  });

  it('delegates an administration update and converts the entity to a DTO', async () => {
    const { repo, service } = setup();
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
    expect(repo.updateUserAdministration).toHaveBeenCalledWith('user-1', dto);
    expect(result).toBeInstanceOf(UserDto);
    expect(result.status.key).toBe('disabled');
  });

  it('propagates repository validation errors when updating a user', async () => {
    const { repo, service } = setup();
    const dto = { role_ids: ['missing-role-id'] };
    const error = new BadRequestException('One or more roles were not found.');
    repo.updateUserAdministration.mockRejectedValue(error);

    await expect(service.updateUser('user-1', dto)).rejects.toBe(error);
    expect(repo.updateUserAdministration).toHaveBeenCalledWith('user-1', dto);
  });
});
