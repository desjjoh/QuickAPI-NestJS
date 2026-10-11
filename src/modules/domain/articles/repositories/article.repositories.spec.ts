import type {
  DataSource,
  EntityManager,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { Order, PaginationOptions } from '@/common/models/pagination.model';
import { ArticleEntity } from '../entities/article.entity';
import { ArticleStatusEntity } from '../entities/articleStatus.entity';
import { ArticleRepository } from './article.repository';
import { ArticleStatusRepository } from './status.repository';

function builder() {
  const chain = {
    clone: jest.fn(),
    innerJoin: jest.fn(),
    leftJoin: jest.fn(),
    andWhere: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
  };
  const query = {
    ...chain,
    getCount: jest.fn().mockResolvedValue(2),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  for (const method of Object.values(chain)) method.mockReturnValue(query);
  return query;
}

function setup<TEntity extends ObjectLiteral>(target: new () => TEntity) {
  const pageQuery = builder();
  const displayQuery = builder();
  const persistence = {
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest
      .fn()
      .mockReturnValueOnce(pageQuery)
      .mockReturnValueOnce(displayQuery),
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
    pageQuery,
    displayQuery,
    persistence: persistence as unknown as jest.Mocked<
      Pick<Repository<TEntity>, 'find' | 'findOne' | 'createQueryBuilder'>
    >,
  };
}

const raw = (id: string) => ({
  id,
  createdAt: new Date('2026-10-08'),
  updatedAt: new Date('2026-10-08'),
  version: 4,
  title: id,
  summary: 'Summary',
  publishedAt: null,
  status_key: 'draft',
  status_label: 'Draft',
  hero_id: 'hero-1',
  hero_storage_key: 'hero.png',
  hero_width: 1,
  hero_height: 1,
  hero_alt_text: null,
  hero_decorative: 1,
  author_id: null,
  avatar_id: null,
});

describe('ArticleRepository', () => {
  it('performs ordered and scoped reads through the supplied manager', async () => {
    const { dataSource, manager, persistence } = setup(ArticleEntity);
    const repository = new ArticleRepository(dataSource);
    persistence.find.mockResolvedValue([]);
    await repository.findAll(manager);
    expect(manager.getRepository).toHaveBeenCalledWith(ArticleEntity);
    expect(persistence.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC', id: 'DESC' },
    });
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

  it.each([Order.ASC, Order.DESC])(
    'pages IDs before display loading and restores %s ordering',
    async (order) => {
      const { dataSource, manager, persistence, pageQuery, displayQuery } =
        setup(ArticleEntity);
      pageQuery.getRawMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      displayQuery.getRawMany.mockResolvedValue([raw('b'), raw('a')]);
      const [rows, count] = await new ArticleRepository(
        dataSource,
      ).paginatePublished(
        manager,
        Object.assign(new PaginationOptions(), { take: 2, page: 3, order }),
        { search: '  100%\t_!  ' },
      );
      expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
      expect(count).toBe(2);
      expect(persistence.createQueryBuilder).toHaveBeenCalledTimes(2);
      expect(pageQuery.getCount).toHaveBeenCalledTimes(1);
      expect(pageQuery.select).toHaveBeenCalledWith('article.id', 'id');
      expect(pageQuery.orderBy).toHaveBeenCalledWith(
        'article.publication.publishedAt',
        order,
      );
      expect(pageQuery.addOrderBy).toHaveBeenCalledWith('article.id', order);
      expect(pageQuery.limit).toHaveBeenCalledWith(2);
      expect(pageQuery.offset).toHaveBeenCalledWith(4);
      expect(pageQuery.leftJoin).not.toHaveBeenCalled();
      for (const query of [pageQuery, displayQuery]) {
        expect(query.andWhere).toHaveBeenCalledWith('status.key = :statusKey', {
          statusKey: 'published',
        });
        expect(query.andWhere).toHaveBeenCalledWith(
          expect.stringMatching(/^\(.* OR .*\)$/),
          { articleSearch: '%100!% !_!!%' },
        );
      }
      expect(displayQuery.andWhere).toHaveBeenCalledWith(
        'article.id IN (:...pageIds)',
        { pageIds: ['a', 'b'] },
      );
      const selected = JSON.stringify(displayQuery.select.mock.calls);
      expect(selected).not.toMatch(/body|password|email|publisher/);
      expect(JSON.stringify(displayQuery.leftJoin.mock.calls)).not.toMatch(
        /roles|permissions|contact/,
      );
      expect(rows[0].media.hero.decorative).toBe(true);
      expect(rows[0].attribution.author).toBeNull();
      expect(rows[0].content).not.toHaveProperty('body');
      expect(rows[0].publication).not.toHaveProperty('publisher');
    },
  );

  it.each(['creator', 'administration'])(
    'retains author/status scope in all %s queries',
    async (audience) => {
      const { dataSource, manager, pageQuery, displayQuery } =
        setup(ArticleEntity);
      pageQuery.getRawMany.mockResolvedValue([{ id: 'a' }]);
      displayQuery.getRawMany.mockResolvedValue([raw('a')]);
      const repository = new ArticleRepository(dataSource);
      const page = new PaginationOptions();
      const query = { statusKey: 'submitted' as const, search: "' OR 1=1" };
      if (audience === 'creator')
        await repository.paginateByAuthor(manager, 'author-1', page, query);
      else
        await repository.paginateForAdministration(manager, page, {
          ...query,
          authorId: 'author-1',
        });
      expect(pageQuery.orderBy).toHaveBeenCalledWith(
        'article.createdAt',
        Order.ASC,
      );
      for (const builder of [pageQuery, displayQuery]) {
        expect(builder.andWhere).toHaveBeenCalledWith(
          'article.attribution.author = :authorId',
          { authorId: 'author-1' },
        );
        expect(builder.andWhere).toHaveBeenCalledWith(
          'status.key = :statusKey',
          { statusKey: 'submitted' },
        );
        expect(builder.andWhere).toHaveBeenCalledWith(
          expect.not.stringContaining('OR 1=1'),
          { articleSearch: "%' OR 1=1%" },
        );
      }
    },
  );

  it.each([undefined, '', ' \t\n\u00a0 '])(
    'omits blank search %j without changing visibility',
    async (search) => {
      const { dataSource, manager, pageQuery } = setup(ArticleEntity);
      pageQuery.getCount.mockResolvedValue(0);
      expect(
        await new ArticleRepository(dataSource).paginatePublished(
          manager,
          new PaginationOptions(),
          { search },
        ),
      ).toEqual([[], 0]);
      expect(pageQuery.andWhere.mock.calls).toEqual([
        ['status.key = :statusKey', { statusKey: 'published' }],
      ]);
      expect(pageQuery.getRawMany).not.toHaveBeenCalled();
    },
  );

  it('retains the total for an out-of-range page without a display query', async () => {
    const { dataSource, manager, persistence, displayQuery } =
      setup(ArticleEntity);
    expect(
      await new ArticleRepository(dataSource).paginateForAdministration(
        manager,
        new PaginationOptions(),
      ),
    ).toEqual([[], 2]);
    expect(persistence.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(displayQuery.getRawMany).not.toHaveBeenCalled();
  });

  it('maps only byline fields and handles an absent avatar', async () => {
    const { dataSource, manager, pageQuery, displayQuery } =
      setup(ArticleEntity);
    pageQuery.getRawMany.mockResolvedValue([{ id: 'a' }]);
    displayQuery.getRawMany.mockResolvedValue([
      {
        ...raw('a'),
        author_id: 'author-1',
        author_first: 'Pat',
        author_last: 'Person',
        author_preferred: 'P',
      },
    ]);
    const [rows] = await new ArticleRepository(
      dataSource,
    ).paginateForAdministration(manager, new PaginationOptions());
    expect(rows[0].attribution.author).toEqual({
      id: 'author-1',
      profile: {
        name: { first: 'Pat', last: 'Person', preferred: 'P' },
        media: { avatar: null },
      },
    });
  });

  it('keeps detail scopes and mutation locks unchanged', async () => {
    const { dataSource, manager, persistence } = setup(ArticleEntity);
    const repository = new ArticleRepository(dataSource);
    persistence.findOne.mockResolvedValue(null);
    await repository.findPublishedById(manager, 'a');
    expect(persistence.findOne).toHaveBeenLastCalledWith({
      where: { id: 'a', publication: { status: { key: 'published' } } },
    });
    await repository.findByIdAndAuthor(manager, 'a', 'author-1');
    expect(persistence.findOne).toHaveBeenLastCalledWith({
      where: { id: 'a', attribution: { author: { id: 'author-1' } } },
    });
    await repository.findByIdAndAuthorForUpdate(manager, 'a', 'author-1');
    expect(persistence.findOne).toHaveBeenLastCalledWith({
      where: { id: 'a', attribution: { author: { id: 'author-1' } } },
      lock: { mode: 'pessimistic_write' },
    });
    await repository.findByIdForUpdate(manager, 'a');
    expect(persistence.findOne).toHaveBeenLastCalledWith({
      where: { id: 'a' },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('does not expose mutation methods', () => {
    const { dataSource } = setup(ArticleEntity);
    const repository = new ArticleRepository(dataSource);
    for (const method of ['create', 'save', 'update', 'delete', 'remove'])
      expect(repository).not.toHaveProperty(method);
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
