import type {
  DataSource,
  EntityManager,
  ObjectLiteral,
  Repository,
} from 'typeorm';

import { ArticleEntity } from '../entities/article.entity';
import { ArticleStatusEntity } from '../entities/articleStatus.entity';
import { ArticleRepository } from './article.repository';
import { ArticleStatusRepository } from './status.repository';

function setup<TEntity extends ObjectLiteral>(target: new () => TEntity) {
  const persistence = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn().mockReturnValue(persistence),
  } as unknown as EntityManager;
  const dataSource = {
    getRepository: jest.fn().mockReturnValue({ manager, target }),
  } as unknown as DataSource;

  return {
    dataSource,
    manager,
    persistence: persistence as unknown as jest.Mocked<
      Pick<Repository<TEntity>, 'find' | 'findOne'>
    >,
  };
}

describe('ArticleRepository', () => {
  it('performs ordered reads through the supplied manager', async () => {
    const { dataSource, manager, persistence } = setup(ArticleEntity);
    const repository = new ArticleRepository(dataSource);
    persistence.find.mockResolvedValue([]);

    await repository.findAll(manager);

    expect(manager.getRepository).toHaveBeenCalledWith(ArticleEntity);
    expect(persistence.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  });

  it('supports status and author-scoped reads', async () => {
    const { dataSource, manager, persistence } = setup(ArticleEntity);
    const repository = new ArticleRepository(dataSource);
    persistence.find.mockResolvedValue([]);

    await repository.findByStatusKey(manager, 'published');
    expect(persistence.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { publication: { status: { key: 'published' } } },
      }),
    );

    await repository.findByAuthorId(manager, 'author-1');
    expect(persistence.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { attribution: { author: { id: 'author-1' } } },
      }),
    );
  });

  it('does not expose mutation methods', () => {
    const { dataSource } = setup(ArticleEntity);
    const repository = new ArticleRepository(dataSource);

    expect(repository).not.toHaveProperty('create');
    expect(repository).not.toHaveProperty('save');
    expect(repository).not.toHaveProperty('update');
    expect(repository).not.toHaveProperty('delete');
    expect(repository).not.toHaveProperty('remove');
  });
});

describe('ArticleStatusRepository', () => {
  it('uses the common manager-first keyed reference reads', async () => {
    const { dataSource, manager, persistence } = setup(ArticleStatusEntity);
    const repository = new ArticleStatusRepository(dataSource);
    persistence.find.mockResolvedValue([]);
    persistence.findOne.mockResolvedValue(null);

    await repository.findAll(manager);
    await repository.findById(manager, 'status-1');
    await repository.findByKey(manager, 'draft');

    expect(persistence.find).toHaveBeenCalledWith({ order: { key: 'ASC' } });
    expect(persistence.findOne).toHaveBeenNthCalledWith(1, {
      where: { id: 'status-1' },
    });
    expect(persistence.findOne).toHaveBeenNthCalledWith(2, {
      where: { key: 'draft' },
    });
  });
});
