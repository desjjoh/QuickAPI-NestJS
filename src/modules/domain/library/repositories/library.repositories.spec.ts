import { DataSource } from 'typeorm';
import { AccountStatusRepository } from './accountstatus.repository';
import { CountryRepository } from './country.repository';
import { GenderRepository } from './gender.repository';
import { PermissionRepository } from './permission.repository';
import { RegionRepository } from './region.repository';
import { RoleRepository } from './role.repository';
import { TimezoneRepository } from './time-zone.repository';

describe('library repository query behavior', () => {
  const dataSource = {
    createEntityManager: jest.fn().mockReturnValue({}),
  } as unknown as DataSource;
  it.each([
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
      const repo = new RepositoryType(dataSource);
      jest.spyOn(repo, 'find').mockResolvedValue([]);

      await repo.findAll();

      expect(repo.find).toHaveBeenCalledWith(options);
    },
  );

  it('scopes region lookup to both region and country references', async () => {
    const repo = new RegionRepository(dataSource);
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);

    await expect(
      repo.findByIdAndCountry('region-id', 'country-id'),
    ).resolves.toBeNull();

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'region-id', country: { id: 'country-id' } },
    });
  });
});
