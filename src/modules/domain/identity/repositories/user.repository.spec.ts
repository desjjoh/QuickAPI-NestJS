import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { ImageService } from '../../media/services/image.service';
import { UserPaginationOptions } from '../models/user.model';
import { UserRepository } from './user.repository';

describe('UserRepository', () => {
  const manager = {
    createQueryBuilder: jest.fn(),
    query: jest.fn(),
    transaction: jest.fn(),
  };
  const imageService = { remove: jest.fn() };
  let repository: UserRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new UserRepository(
      imageService as unknown as ImageService,
      {
        createEntityManager: jest.fn().mockReturnValue(manager),
      } as unknown as DataSource,
    );
  });

  function mutationBuilder() {
    const builder = {
      update: jest.fn(),
      set: jest.fn(),
      where: jest.fn(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    Object.values(builder).forEach((mock) => mock.mockReturnValue(builder));
    manager.createQueryBuilder.mockReturnValue(builder);
    return builder;
  }

  it('increments token versions for active user sessions', async () => {
    const builder = mutationBuilder();

    await repository.incrementTokenVersion('user-1');

    expect(builder.set).toHaveBeenCalledWith({
      token_version: expect.any(Function),
    });
    expect(builder.set.mock.calls[0][0].token_version()).toBe(
      '`token_version` + 1',
    );
    expect(builder.where).toHaveBeenCalledWith(
      'userId = :userId AND active = true',
      { userId: 'user-1' },
    );
    expect(builder.execute).toHaveBeenCalled();
  });

  it('revokes every active session for a user', async () => {
    const builder = mutationBuilder();

    await repository.revokeAllSessions('user-1');

    expect(builder.set).toHaveBeenCalledWith({ active: false, refresh: null });
    expect(builder.where).toHaveBeenCalledWith(
      'userId = :userId AND active = true',
      { userId: 'user-1' },
    );
  });

  it('builds the complete paginated user query', async () => {
    const result = [[{ id: 'user-1' }], 1];
    const builder = {
      leftJoinAndSelect: jest.fn(),
      where: jest.fn(),
      orderBy: jest.fn(),
      take: jest.fn(),
      skip: jest.fn(),
      getManyAndCount: jest.fn().mockResolvedValue(result),
    };
    Object.values(builder)
      .slice(0, -1)
      .forEach((mock) => mock.mockReturnValue(builder));
    jest
      .spyOn(repository, 'createQueryBuilder')
      .mockReturnValue(builder as never);

    await expect(
      repository.paginate({
        sort: 'user.createdAt',
        search: 'Ada',
        order: 'DESC',
        take: 20,
        skip: 40,
      } as unknown as UserPaginationOptions),
    ).resolves.toBe(result);

    expect(builder.leftJoinAndSelect).toHaveBeenCalledTimes(13);
    expect(builder.where).toHaveBeenCalledWith(expect.any(String), {
      query: '%Ada%',
    });
    expect(builder.orderBy).toHaveBeenCalledWith({
      'user.createdAt': 'DESC',
    });
    expect(builder.orderBy).toHaveBeenCalledWith('user.createdAt', 'DESC');
    expect(builder.take).toHaveBeenCalledWith(20);
    expect(builder.skip).toHaveBeenCalledWith(40);
  });

  it.each([
    ['fullname', "CONCAT(profile.name.first, ' ', profile.name.last)"],
    ['user.metadata.last_sign_in', 'user.metadata.last_sign_in'],
  ])('uses the database expression for the %s sort', async (sort, expected) => {
    const builder = {
      leftJoinAndSelect: jest.fn(),
      where: jest.fn(),
      orderBy: jest.fn(),
      take: jest.fn(),
      skip: jest.fn(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    Object.values(builder)
      .slice(0, -1)
      .forEach((mock) => mock.mockReturnValue(builder));
    jest
      .spyOn(repository, 'createQueryBuilder')
      .mockReturnValue(builder as never);

    await repository.paginate({
      sort,
      search: '',
      order: 'ASC',
      take: 25,
      skip: 0,
    } as unknown as UserPaginationOptions);

    expect(builder.orderBy).toHaveBeenCalledWith(expected, 'ASC');
  });

  it('uses the expected criteria for common user lookups', async () => {
    const find = jest.spyOn(repository, 'find').mockResolvedValue([]);
    const findOne = jest.spyOn(repository, 'findOne').mockResolvedValue(null);

    await repository.findAll();
    await repository.findByEmail('ada@example.com');
    await repository.findByPhone('+15555550100');

    expect(find).toHaveBeenCalledWith({ order: { createdAt: 'ASC' } });
    expect(findOne).toHaveBeenNthCalledWith(1, {
      where: { identity: { email: 'ada@example.com' } },
    });
    expect(findOne).toHaveBeenNthCalledWith(2, {
      where: {
        profile: { contact: { phone: { phone_e164: '+15555550100' } } },
      },
    });
  });

  it('returns a user by id and rejects a missing user', async () => {
    const user = { id: 'user-1' };
    jest
      .spyOn(repository, 'findOne')
      .mockResolvedValueOnce(user as never)
      .mockResolvedValueOnce(null);

    await expect(repository.findByIdOrFail('user-1')).resolves.toBe(user);
    await expect(repository.findByIdOrFail('missing')).rejects.toEqual(
      new NotFoundException('User not found.'),
    );
  });

  it('clears an avatar and creates then reloads a user', async () => {
    await repository.clearProfileAvatar('profile-1');
    expect(manager.query).toHaveBeenCalledWith(
      'UPDATE `user_profiles` SET `avatar_id` = NULL WHERE `id` = ?',
      ['profile-1'],
    );

    const created = { id: 'user-1' };
    const loaded = { id: 'user-1', identity: { email: 'ada@example.com' } };
    jest.spyOn(repository, 'create').mockReturnValue(created as never);
    jest.spyOn(repository, 'save').mockResolvedValue(created as never);
    jest.spyOn(repository, 'findByIdOrFail').mockResolvedValue(loaded as never);

    await expect(
      repository.createUser({ identity: { email: 'ada@example.com' } }),
    ).resolves.toBe(loaded);
    expect(repository.findByIdOrFail).toHaveBeenCalledWith('user-1');
  });

  it.each([true, false])(
    'removes a user and profile (avatar present: %s)',
    async (hasAvatar) => {
      const avatar = hasAvatar ? { id: 'image-1' } : null;
      const user = {
        id: 'user-1',
        profile: { id: 'profile-1', media: { avatar } },
      };
      const transactionalManager = {
        remove: jest.fn(),
        delete: jest.fn(),
      };
      jest.spyOn(repository, 'findByIdOrFail').mockResolvedValue(user as never);
      manager.transaction.mockImplementation(async (work) =>
        work(transactionalManager as unknown as EntityManager),
      );

      await repository.removeUser('user-1');

      expect(transactionalManager.remove).toHaveBeenCalledWith(
        expect.any(Function),
        user,
      );
      expect(transactionalManager.delete).toHaveBeenCalledWith(
        expect.any(Function),
        { id: 'profile-1' },
      );
      expect(imageService.remove).toHaveBeenCalledTimes(hasAvatar ? 1 : 0);
    },
  );

  describe('updateUserAdministration', () => {
    const user = { id: 'user-1', roles: [{ id: 'old-role' }] };
    const relation = {
      relation: jest.fn(),
      of: jest.fn(),
      set: jest.fn(),
      addAndRemove: jest.fn(),
    };
    const transactionalManager = {
      findOneBy: jest.fn(),
      findBy: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    beforeEach(() => {
      Object.values(relation).forEach((mock) => mock.mockReturnValue(relation));
      transactionalManager.createQueryBuilder.mockReturnValue(relation);
      manager.transaction.mockImplementation(async (work) =>
        work(transactionalManager as unknown as EntityManager),
      );
      jest.spyOn(repository, 'findByIdOrFail').mockResolvedValue(user as never);
    });

    it('updates status and roles, then reloads the user', async () => {
      transactionalManager.findOneBy.mockResolvedValue({ id: 'active' });
      transactionalManager.findBy.mockResolvedValue([
        { id: 'admin' },
        { id: 'editor' },
      ]);

      await expect(
        repository.updateUserAdministration('user-1', {
          status_id: 'active',
          role_ids: ['admin', 'editor'],
        }),
      ).resolves.toBe(user);

      expect(relation.set).toHaveBeenCalledWith('active');
      expect(relation.addAndRemove).toHaveBeenCalledWith(
        [{ id: 'admin' }, { id: 'editor' }],
        user.roles,
      );
      expect(repository.findByIdOrFail).toHaveBeenCalledTimes(2);
    });

    it('allows an update with neither optional association', async () => {
      await repository.updateUserAdministration('user-1', {});

      expect(transactionalManager.findOneBy).not.toHaveBeenCalled();
      expect(transactionalManager.findBy).not.toHaveBeenCalled();
      expect(relation.set).not.toHaveBeenCalled();
      expect(relation.addAndRemove).not.toHaveBeenCalled();
    });

    it('rejects an unknown status', async () => {
      transactionalManager.findOneBy.mockResolvedValue(null);

      await expect(
        repository.updateUserAdministration('user-1', {
          status_id: 'missing',
        }),
      ).rejects.toEqual(new BadRequestException('Account status not found.'));
    });

    it('rejects missing or duplicate role results', async () => {
      transactionalManager.findBy.mockResolvedValue([{ id: 'admin' }]);

      await expect(
        repository.updateUserAdministration('user-1', {
          role_ids: ['admin', 'missing'],
        }),
      ).rejects.toEqual(
        new BadRequestException('One or more roles were not found.'),
      );
    });
  });
});
