import type { DataSource, EntityManager, Repository } from 'typeorm';

import { UserPaginationOptions } from '../models/user.model';
import { UserRepository } from './user.repository';

const setup = () => {
  const builder = {
    leftJoinAndSelect: jest.fn(),
    where: jest.fn(),
    addSelect: jest.fn(),
    orderBy: jest.fn(),
    take: jest.fn(),
    skip: jest.fn(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  Object.values(builder)
    .slice(0, -1)
    .forEach((mock) => mock.mockReturnValue(builder));

  const persistence = {
    target: class User {},
    createQueryBuilder: jest.fn().mockReturnValue(builder),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const manager = {
    getRepository: jest.fn().mockReturnValue(persistence),
  } as unknown as EntityManager;
  Object.assign(persistence, { manager });
  const dataSource = {
    getRepository: jest.fn().mockReturnValue(persistence),
  } as unknown as DataSource;

  return {
    builder,
    manager,
    persistence: persistence as unknown as jest.Mocked<Repository<never>>,
    repository: new UserRepository(dataSource),
  };
};

describe('UserRepository', () => {
  it('builds the complete paginated user query', async () => {
    const { builder, manager, repository } = setup();

    await repository.paginate(manager, {
      sort: 'user.createdAt',
      search: 'Ada',
      order: 'DESC',
      take: 20,
      skip: 40,
    } as unknown as UserPaginationOptions);

    expect(builder.leftJoinAndSelect).toHaveBeenCalledTimes(13);
    expect(builder.where).toHaveBeenCalledWith(expect.any(String), {
      query: '%Ada%',
    });
    expect(builder.addSelect).toHaveBeenCalledWith(
      "CONCAT(profile.name.first, ' ', profile.name.last)",
      'fullname',
    );
    expect(builder.orderBy).toHaveBeenCalledWith({
      'user.createdAt': 'DESC',
    });
    expect(builder.take).toHaveBeenCalledWith(20);
    expect(builder.skip).toHaveBeenCalledWith(40);
  });

  it.each(['fullname', 'user.metadata.last_sign_in'])(
    'uses the selected column for the %s sort',
    async (sort) => {
      const { builder, manager, repository } = setup();

      await repository.paginate(manager, {
        sort,
        search: '',
        order: 'ASC',
        take: 25,
        skip: 0,
      } as unknown as UserPaginationOptions);

      expect(builder.orderBy).toHaveBeenCalledWith({ [sort]: 'ASC' });
    },
  );

  it('uses the supplied manager for common user lookups', async () => {
    const { manager, persistence, repository } = setup();

    await repository.findAll(manager);
    await repository.findByEmail(manager, 'ada@example.com');
    await repository.findByPhone(manager, '+15555550100');
    await repository.findById(manager, 'user-1');

    expect(persistence.find).toHaveBeenCalledWith({
      order: { createdAt: 'ASC' },
    });
    expect(persistence.findOne).toHaveBeenNthCalledWith(1, {
      where: { identity: { email: 'ada@example.com' } },
    });
    expect(persistence.findOne).toHaveBeenNthCalledWith(2, {
      where: {
        profile: { contact: { phone: { phone_e164: '+15555550100' } } },
      },
    });
    expect(persistence.findOne).toHaveBeenNthCalledWith(3, {
      where: { id: 'user-1' },
    });
  });

  it('does not expose persistence mutation methods', () => {
    const { repository } = setup();

    expect(repository).not.toHaveProperty('create');
    expect(repository).not.toHaveProperty('update');
    expect(repository).not.toHaveProperty('remove');
  });
});
