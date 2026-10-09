import type {
  DataSource,
  EntityManager,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { Like } from 'typeorm';

import { ArticleEntity } from '../entities/article.entity';
import { ArticleStatusEntity } from '../entities/articleStatus.entity';
import { ArticleRepository } from './article.repository';
import { ArticleStatusRepository } from './status.repository';

function setup<TEntity extends ObjectLiteral>(target: new () => TEntity) {
  const persistence = {
    find: jest.fn(),
    findAndCount: jest.fn(),
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
      Pick<Repository<TEntity>, 'find' | 'findAndCount' | 'findOne'>
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

  it('paginates only published articles for public collections', async () => {
    const { dataSource, manager, persistence } = setup(ArticleEntity);
    const repository = new ArticleRepository(dataSource);
    persistence.findAndCount.mockResolvedValue([[], 0]);

    await repository.paginatePublished(
      manager,
      { take: 10, skip: 20 } as never,
      { search: '  architecture  ' },
    );

    expect(persistence.findAndCount).toHaveBeenCalledWith({
      where: [
        {
          publication: { status: { key: 'published' } },
          content: { title: Like('%architecture%') },
        },
        {
          publication: { status: { key: 'published' } },
          content: { summary: Like('%architecture%') },
        },
      ],
      order: { publication: { publishedAt: 'DESC' }, id: 'DESC' },
      take: 10,
      skip: 20,
    });
  });

  it('finds public detail only when the article is published', async () => {
    const { dataSource, manager, persistence } = setup(ArticleEntity);
    const repository = new ArticleRepository(dataSource);
    persistence.findOne.mockResolvedValue(null);

    await repository.findPublishedById(manager, 'article-1');

    expect(persistence.findOne).toHaveBeenCalledWith({
      where: {
        id: 'article-1',
        publication: { status: { key: 'published' } },
      },
    });
  });

  it('scopes creator collections and detail reads to the author', async () => {
    const { dataSource, manager, persistence } = setup(ArticleEntity);
    const repository = new ArticleRepository(dataSource);
    persistence.findAndCount.mockResolvedValue([[], 0]);
    persistence.findOne.mockResolvedValue(null);

    await repository.paginateByAuthor(
      manager,
      'author-1',
      { take: 25, skip: 0 } as never,
      { statusKey: 'submitted' },
    );
    await repository.findByIdAndAuthor(manager, 'article-1', 'author-1');

    expect(persistence.findAndCount).toHaveBeenCalledWith({
      where: {
        attribution: { author: { id: 'author-1' } },
        publication: { status: { key: 'submitted' } },
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 25,
      skip: 0,
    });
    expect(persistence.findOne).toHaveBeenCalledWith({
      where: {
        id: 'article-1',
        attribution: { author: { id: 'author-1' } },
      },
    });
  });

  it('locks creator-owned articles for mutation', async () => {
    const { dataSource, manager, persistence } = setup(ArticleEntity);
    const repository = new ArticleRepository(dataSource);
    persistence.findOne.mockResolvedValue(null);

    await repository.findByIdAndAuthorForUpdate(
      manager,
      'article-1',
      'author-1',
    );

    expect(persistence.findOne).toHaveBeenCalledWith({
      where: {
        id: 'article-1',
        attribution: { author: { id: 'author-1' } },
      },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('locks articles for administration mutations', async () => {
    const { dataSource, manager, persistence } = setup(ArticleEntity);
    const repository = new ArticleRepository(dataSource);
    persistence.findOne.mockResolvedValue(null);

    await repository.findByIdForUpdate(manager, 'article-1');

    expect(persistence.findOne).toHaveBeenCalledWith({
      where: { id: 'article-1' },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('paginates administration results with bounded status and author filters', async () => {
    const { dataSource, manager, persistence } = setup(ArticleEntity);
    const repository = new ArticleRepository(dataSource);
    persistence.findAndCount.mockResolvedValue([[], 0]);

    await repository.paginateForAdministration(
      manager,
      { take: 50, skip: 100 } as never,
      { authorId: 'author-1', statusKey: 'archived' },
    );

    expect(persistence.findAndCount).toHaveBeenCalledWith({
      where: {
        attribution: { author: { id: 'author-1' } },
        publication: { status: { key: 'archived' } },
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 50,
      skip: 100,
    });
  });

  it('treats whitespace-only searches as absent', async () => {
    const { dataSource, manager, persistence } = setup(ArticleEntity);
    const repository = new ArticleRepository(dataSource);
    persistence.findAndCount.mockResolvedValue([[], 0]);

    await repository.paginateForAdministration(
      manager,
      { take: 25, skip: 0 } as never,
      { search: '   ' },
    );

    expect(persistence.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
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
