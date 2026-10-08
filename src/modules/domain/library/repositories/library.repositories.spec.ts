import type { DataSource, EntityManager, Repository } from 'typeorm';

import { AccountStatusRepository } from './accountstatus.repository';
import { CountryRepository } from './country.repository';
import { GenderRepository } from './gender.repository';
import { PermissionRepository } from './permission.repository';
import { RegionRepository } from './region.repository';
import { RoleRepository } from './role.repository';
import { TimezoneRepository } from './time-zone.repository';

type LibraryRepository = {
  findAll(manager: EntityManager): Promise<unknown[]>;
};

type LibraryRepositoryConstructor = new (
  dataSource: DataSource,
) => LibraryRepository;

const setup = () => {
  const persistence = {
    target: class ReferenceEntity {},
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
    dataSource,
    manager,
    persistence: persistence as unknown as jest.Mocked<Repository<never>>,
  };
};

describe('library repository query behavior', () => {
  it.each<[LibraryRepositoryConstructor, Record<string, unknown>]>([
    [AccountStatusRepository, { order: { key: 'ASC' } }],
    [GenderRepository, { order: { key: 'ASC' } }],
    [PermissionRepository, { order: { key: 'ASC' } }],
    [RoleRepository, { order: { key: 'ASC' } }],
    [TimezoneRepository, { order: { key: 'ASC' } }],
    [
      CountryRepository,
      {
        relations: { regions: true },
        order: { key: 'ASC', regions: { key: 'ASC' } },
      },
    ],
    [RegionRepository, { order: { country: { key: 'ASC' }, key: 'ASC' } }],
  ])(
    '%p applies its deterministic listing shape',
    async (RepositoryType, options) => {
      const { dataSource, manager, persistence } = setup();
      const repository = new RepositoryType(dataSource);

      await repository.findAll(manager);

      expect(manager.getRepository).toHaveBeenCalled();
      expect(persistence.find).toHaveBeenCalledWith(options);
    },
  );

  it('scopes region lookup to both region and country references', async () => {
    const { dataSource, manager, persistence } = setup();
    const repository = new RegionRepository(dataSource);

    await expect(
      repository.findByIdAndCountry(manager, 'region-id', 'country-id'),
    ).resolves.toBeNull();

    expect(persistence.findOne).toHaveBeenCalledWith({
      where: { id: 'region-id', country: { id: 'country-id' } },
    });
  });

  it('does not expose persistence mutation methods', () => {
    const { dataSource } = setup();
    const repository = new GenderRepository(dataSource);

    expect(repository).not.toHaveProperty('create');
    expect(repository).not.toHaveProperty('update');
    expect(repository).not.toHaveProperty('remove');
  });
});
