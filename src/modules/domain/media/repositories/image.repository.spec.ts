import type { DataSource, EntityManager, Repository } from 'typeorm';

import { ImageRepository } from './image.repository';

const setup = () => {
  const persistence = {
    target: class Image {},
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
    manager,
    persistence: persistence as unknown as jest.Mocked<Repository<never>>,
    repository: new ImageRepository(dataSource),
  };
};

describe('ImageRepository behavior', () => {
  it('orders newest images first using the supplied manager', async () => {
    const { manager, persistence, repository } = setup();

    await repository.findAll(manager);

    expect(manager.getRepository).toHaveBeenCalled();
    expect(persistence.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
    });
  });

  it('finds an image by its storage key', async () => {
    const { manager, persistence, repository } = setup();

    await expect(
      repository.findByStorageKey(manager, 'avatars/image.png'),
    ).resolves.toBeNull();

    expect(persistence.findOne).toHaveBeenCalledWith({
      where: { storage_key: 'avatars/image.png' },
    });
  });

  it('does not expose persistence mutation methods', () => {
    const { repository } = setup();

    expect(repository).not.toHaveProperty('create');
    expect(repository).not.toHaveProperty('update');
    expect(repository).not.toHaveProperty('remove');
  });
});
