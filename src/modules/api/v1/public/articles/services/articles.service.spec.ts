import { ArticleEntity } from '@/modules/domain/articles/entities/article.entity';

import { PublicArticleQueryDto } from '../models/article-query.model';
import { PublicArticleApiService } from './articles.service';

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
      status: { id: 'status-1', key: 'published', label: 'Published' },
      publisher: null,
      publishedAt: new Date('2026-10-02T12:00:00.000Z'),
    },
  } as ArticleEntity;
}

describe('PublicArticleApiService', () => {
  const articles = {
    paginatePublished: jest.fn(),
    findPublishedByIdOrFail: jest.fn(),
  };
  const service = new PublicArticleApiService(articles as never);

  beforeEach(() => jest.clearAllMocks());

  it('maps the published collection and pagination metadata', async () => {
    const query = Object.assign(new PublicArticleQueryDto(), {
      search: 'Title',
      page: 2,
      take: 10,
    });
    articles.paginatePublished.mockResolvedValue([[article()], 21]);

    const result = await service.list(query);

    expect(articles.paginatePublished).toHaveBeenCalledWith(query, {
      search: 'Title',
    });
    expect(result.data).toEqual([
      expect.objectContaining({ id: 'article-1', title: 'Title' }),
    ]);
    expect(result.meta).toEqual(
      expect.objectContaining({
        page: 2,
        take: 10,
        itemCount: 21,
        pageCount: 3,
        hasPreviousPage: true,
        hasNextPage: true,
      }),
    );
  });

  it('maps published article detail', async () => {
    articles.findPublishedByIdOrFail.mockResolvedValue(article());

    await expect(service.find('article-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'article-1',
        title: 'Title',
        body: 'Body',
      }),
    );
    expect(articles.findPublishedByIdOrFail).toHaveBeenCalledWith('article-1');
  });
});
