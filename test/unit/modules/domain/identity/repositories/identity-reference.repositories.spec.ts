import type { DataSource, EntityManager, Repository } from 'typeorm';

import { AccountStatusRepository } from '@/modules/domain/identity/repositories/accountstatus.repository';
import { GenderRepository } from '@/modules/domain/identity/repositories/gender.repository';
import { PermissionRepository } from '@/modules/domain/identity/repositories/permission.repository';
import { RoleRepository } from '@/modules/domain/identity/repositories/role.repository';

type IdentityReferenceRepository = {
  findAll(manager: EntityManager): Promise<unknown[]>;
};

type IdentityReferenceRepositoryConstructor = new (
  dataSource: DataSource,
) => IdentityReferenceRepository;

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

describe('identity reference repository query behavior', () => {
  it.each<[IdentityReferenceRepositoryConstructor, Record<string, unknown>]>([
    [AccountStatusRepository, { order: { key: 'ASC' } }],
    [GenderRepository, { order: { key: 'ASC' } }],
    [PermissionRepository, { order: { key: 'ASC' } }],
    [RoleRepository, { order: { key: 'ASC' } }],
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

  it('does not expose persistence mutation methods', () => {
    const { dataSource } = setup();
    const repository = new GenderRepository(dataSource);

    expect(repository).not.toHaveProperty('create');
    expect(repository).not.toHaveProperty('update');
    expect(repository).not.toHaveProperty('remove');
  });
});
