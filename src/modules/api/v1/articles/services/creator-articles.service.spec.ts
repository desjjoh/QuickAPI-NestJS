import { ArticleEntity } from '@/modules/domain/articles/entities/article.entity';

import { CreatorArticleQueryDto } from '../models/article-query.model';
import { CreatorArticleApiService } from './creator-articles.service';

function article(): ArticleEntity {
  return {
    id: 'article-1',
    createdAt: new Date('2026-10-01T12:00:00.000Z'),
    updatedAt: new Date('2026-10-02T12:00:00.000Z'),
    content: { title: 'Title', summary: 'Summary', body: 'Body' },
    media: {
      hero: {
        id: 'image-1',
        storage_key: 'articles/hero.png',
        filename: 'hero.png',
        mime_type: 'image/png',
        size_bytes: 100,
        width: 1200,
        height: 630,
        alt_text: 'Hero',
      },
    },
    attribution: { author: null },
    publication: {
      status: { id: 'status-1', key: 'draft', label: 'Draft' },
      publisher: null,
      publishedAt: null,
    },
  } as ArticleEntity;
}

describe('CreatorArticleApiService', () => {
  const manager = {};
  const articles = {
    paginateByAuthor: jest.fn(),
    findByIdAndAuthorOrFail: jest.fn(),
    transaction: jest.fn(),
    create: jest.fn(),
    createWithHero: jest.fn(),
    findByIdAndAuthorForUpdateOrFail: jest.fn(),
    update: jest.fn(),
    updateHero: jest.fn(),
    submit: jest.fn(),
    withdraw: jest.fn(),
  };
  const audit = { record: jest.fn().mockResolvedValue({}) };
  const service = new CreatorArticleApiService(
    articles as never,
    audit as never,
  );
  const user = { id: 'creator-1' };
  const file = { originalname: 'hero.png' } as Express.Multer.File;

  beforeEach(() => {
    jest.clearAllMocks();
    articles.transaction.mockImplementation(async (work) => work(manager));
    audit.record.mockResolvedValue({});
  });

  it('maps an author-scoped collection and pagination metadata', async () => {
    const query = Object.assign(new CreatorArticleQueryDto(), {
      search: 'Title',
      statusKey: 'draft',
      page: 2,
      take: 10,
    });
    articles.paginateByAuthor.mockResolvedValue([[article()], 21]);

    const result = await service.list(user as never, query);

    expect(articles.paginateByAuthor).toHaveBeenCalledWith('creator-1', query, {
      search: 'Title',
      statusKey: 'draft',
    });
    expect(result.data).toEqual([
      expect.objectContaining({ id: 'article-1', title: 'Title' }),
    ]);
    expect(result.meta).toEqual(
      expect.objectContaining({ page: 2, take: 10, itemCount: 21 }),
    );
  });

  it('returns only detail scoped to the authenticated author', async () => {
    articles.findByIdAndAuthorOrFail.mockResolvedValue(article());

    await expect(service.find(user as never, 'article-1')).resolves.toEqual(
      expect.objectContaining({ id: 'article-1', body: 'Body' }),
    );
    expect(articles.findByIdAndAuthorOrFail).toHaveBeenCalledWith(
      'article-1',
      'creator-1',
    );
  });

  it('creates a draft transactionally with the authenticated user as author', async () => {
    const dto = {
      title: 'Title',
      summary: 'Summary',
      body: 'Body',
      hero_alt_text: 'Hero description',
    };
    articles.createWithHero.mockResolvedValue(article());

    await expect(service.create(user as never, dto, file)).resolves.toEqual(
      expect.objectContaining({
        id: 'article-1',
        status: expect.objectContaining({ key: 'draft' }),
      }),
    );
    expect(articles.createWithHero).toHaveBeenCalledWith(
      {
        content: {
          title: 'Title',
          summary: 'Summary',
          body: 'Body',
        },
        authorId: 'creator-1',
        hero: {
          file,
          altText: 'Hero description',
          folder: 'articles/creator-1/heroes',
        },
      },
      manager,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'articles',
        event: 'articles.article.created',
        actorType: 'user',
        actorId: 'creator-1',
        subjectType: 'article',
        subjectId: 'article-1',
        resourceType: 'articles.article',
        resourceId: 'article-1',
        before: null,
        after: expect.objectContaining({ id: 'article-1' }),
      }),
      manager,
    );
  });

  it('updates a locked creator-owned draft without changing attribution', async () => {
    const current = article();
    const updated = article();
    Object.assign(updated.content, { title: 'Updated' });
    articles.findByIdAndAuthorForUpdateOrFail.mockResolvedValue(current);
    articles.update.mockResolvedValue(updated);

    await expect(
      service.update(user as never, 'article-1', { title: 'Updated' }),
    ).resolves.toEqual(expect.objectContaining({ title: 'Updated' }));

    expect(articles.findByIdAndAuthorForUpdateOrFail).toHaveBeenCalledWith(
      'article-1',
      'creator-1',
      manager,
    );
    expect(articles.update).toHaveBeenCalledWith(
      current,
      {
        content: {
          title: 'Updated',
          summary: undefined,
          body: undefined,
        },
      },
      manager,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'articles.article.updated',
        before: expect.objectContaining({
          content: expect.objectContaining({ title: 'Title' }),
        }),
        after: expect.objectContaining({
          content: expect.objectContaining({ title: 'Updated' }),
        }),
      }),
      manager,
    );
  });

  it('rejects an empty update before opening a transaction', async () => {
    await expect(
      service.update(user as never, 'article-1', {}),
    ).rejects.toThrow('At least one article field is required.');
    expect(articles.transaction).not.toHaveBeenCalled();
  });

  it.each(['submit', 'withdraw'] as const)(
    '%s transitions a locked creator-owned article',
    async (action) => {
      const current = article();
      articles.findByIdAndAuthorForUpdateOrFail.mockResolvedValue(current);
      articles[action].mockResolvedValue(current);

      await expect(
        service[action](user as never, 'article-1'),
      ).resolves.toEqual(expect.objectContaining({ id: 'article-1' }));

      expect(articles.findByIdAndAuthorForUpdateOrFail).toHaveBeenCalledWith(
        'article-1',
        'creator-1',
        manager,
      );
      expect(articles[action]).toHaveBeenCalledWith(current, manager);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          event: `articles.article.${action === 'submit' ? 'submitted' : 'withdrawn'}`,
          actorId: 'creator-1',
          resourceId: 'article-1',
        }),
        manager,
      );
    },
  );

  it('replaces the hero of a locked creator-owned draft and audits the image', async () => {
    const current = article();
    const updated = article();
    Object.assign(updated.media.hero, {
      filename: 'replacement.png',
      size_bytes: 200,
      alt_text: 'Replacement hero',
    });
    articles.findByIdAndAuthorForUpdateOrFail.mockResolvedValue(current);
    articles.updateHero.mockResolvedValue(updated);

    await expect(
      service.updateHero(
        user as never,
        'article-1',
        { hero_alt_text: 'Replacement hero' },
        file,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'article-1' }));

    expect(articles.updateHero).toHaveBeenCalledWith(
      current,
      {
        file,
        altText: 'Replacement hero',
        folder: 'articles/creator-1/heroes',
      },
      manager,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'articles.article.hero_replaced',
        actorId: 'creator-1',
        subjectId: 'article-1',
        resourceType: 'media.image',
        resourceId: 'image-1',
        before: expect.objectContaining({ filename: 'hero.png' }),
        after: expect.objectContaining({ filename: 'replacement.png' }),
        meaningfulWithoutChanges: true,
      }),
      manager,
    );
  });

  it('fails the mutation transaction when its audit event cannot be recorded', async () => {
    articles.createWithHero.mockResolvedValue(article());
    audit.record.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      service.create(
        user as never,
        {
          title: 'Title',
          summary: 'Summary',
          body: 'Body',
        },
        file,
      ),
    ).rejects.toThrow('audit unavailable');

    expect(audit.record).toHaveBeenCalledWith(expect.any(Object), manager);
  });
});
