import type { DataSource, EntityManager, Repository } from 'typeorm';

import { CountryRepository } from '@/modules/domain/library/repositories/country.repository';
import { RegionRepository } from '@/modules/domain/library/repositories/region.repository';
import { TimezoneRepository } from '@/modules/domain/library/repositories/time-zone.repository';

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
});
