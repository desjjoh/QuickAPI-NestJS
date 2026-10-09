import { ArticleEntity } from '@/modules/domain/articles/entities/article.entity';
import { ConflictException } from '@nestjs/common';
import { ADMINISTRATION_REASON_CODES } from '@/config/administration.config';

import { AdministrationArticleQueryDto } from '../models/article-query.model';
import { ArticleAdministrationApiService } from './articles.service';

function article(status = 'submitted'): ArticleEntity {
  return {
    id: 'article-1',
    version: 1,
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
      status: { id: `status-${status}`, key: status, label: 'Status' },
      publisher: null,
      publishedAt: null,
    },
  } as ArticleEntity;
}

describe('ArticleAdministrationApiService', () => {
  const manager = {};
  const articles = {
    paginateForAdministration: jest.fn(),
    findByIdOrFail: jest.fn(),
    transaction: jest.fn(),
    findByIdForUpdateOrFail: jest.fn(),
    publish: jest.fn(),
    returnToDraft: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
  };
  const audit = { record: jest.fn().mockResolvedValue({}) };
  const service = new ArticleAdministrationApiService(
    articles as never,
    audit as never,
  );
  const administrator = { id: 'administrator-1' };
  const actionDto = {
    expected_version: 1,
    reason_code: ADMINISTRATION_REASON_CODES.POLICY_ENFORCEMENT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    articles.transaction.mockImplementation(async (work) => work(manager));
    audit.record.mockResolvedValue({});
  });

  it('maps the filtered review queue and pagination metadata', async () => {
    const query = Object.assign(new AdministrationArticleQueryDto(), {
      search: 'Title',
      statusKey: 'submitted',
      authorId: 'A1b2C3d4E5f6G7h8',
      page: 2,
      take: 10,
    });
    articles.paginateForAdministration.mockResolvedValue([[article()], 21]);

    const result = await service.list(query);

    expect(articles.paginateForAdministration).toHaveBeenCalledWith(query, {
      search: 'Title',
      statusKey: 'submitted',
      authorId: 'A1b2C3d4E5f6G7h8',
    });
    expect(result.data).toEqual([
      expect.objectContaining({ id: 'article-1', title: 'Title' }),
    ]);
    expect(result.meta).toEqual(
      expect.objectContaining({ page: 2, take: 10, itemCount: 21 }),
    );
  });

  it('maps unrestricted article detail for review', async () => {
    articles.findByIdOrFail.mockResolvedValue(article());

    await expect(service.find('article-1')).resolves.toEqual(
      expect.objectContaining({ id: 'article-1', body: 'Body' }),
    );
    expect(articles.findByIdOrFail).toHaveBeenCalledWith('article-1');
  });

  it.each([
    ['returnToDraft', 'returnToDraft'],
    ['archive', 'archive'],
    ['restore', 'restore'],
  ] as const)(
    '%s locks the article and applies the administration transition',
    async (method, domainMethod) => {
      const current = article();
      articles.findByIdForUpdateOrFail.mockResolvedValue(current);
      articles[domainMethod].mockResolvedValue(current);

      await expect(
        service[method](administrator as never, 'article-1', actionDto),
      ).resolves.toEqual(expect.objectContaining({ id: 'article-1' }));

      expect(articles.findByIdForUpdateOrFail).toHaveBeenCalledWith(
        'article-1',
        manager,
      );
      expect(articles[domainMethod]).toHaveBeenCalledWith(current, manager);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'articles',
          event: `articles.article.${
            method === 'returnToDraft'
              ? 'returned_to_draft'
              : method === 'archive'
                ? 'archived'
                : 'restored'
          }`,
          actorType: 'admin',
          actorId: 'administrator-1',
          subjectType: 'article',
          subjectId: 'article-1',
          resourceType: 'articles.article',
          resourceId: 'article-1',
          metadata: { reason_code: 'policy_enforcement' },
        }),
        manager,
      );
    },
  );

  it.each(['publish', 'returnToDraft', 'archive', 'restore'] as const)(
    'rejects stale %s without mutation or audit',
    async (action) => {
      const current = article();
      Object.assign(current, { version: 2 });
      articles.findByIdForUpdateOrFail.mockResolvedValue(current);
      await expect(
        service[action](administrator as never, 'article-1', actionDto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(articles[action]).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    },
  );

  it('publishes with the authenticated administrator and server time', async () => {
    const current = article();
    articles.findByIdForUpdateOrFail.mockResolvedValue(current);
    articles.publish.mockResolvedValue(article('published'));

    await service.publish(administrator as never, 'article-1', {
      expected_version: 1,
    });

    expect(articles.publish).toHaveBeenCalledWith(
      current,
      'administrator-1',
      expect.any(Date),
      manager,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'articles.article.published',
        actorType: 'admin',
        actorId: 'administrator-1',
        metadata: {},
      }),
      manager,
    );
  });

  it('fails the mutation transaction when its audit event cannot be recorded', async () => {
    const current = article();
    articles.findByIdForUpdateOrFail.mockResolvedValue(current);
    articles.publish.mockResolvedValue(article('published'));
    audit.record.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      service.publish(administrator as never, 'article-1', {
        expected_version: 1,
      }),
    ).rejects.toThrow('audit unavailable');
  });
});
