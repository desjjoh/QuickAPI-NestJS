import { ArticleEntity } from '../entities/article.entity';
import { ArticleDto } from './article.model';
import {
  ArticleManagementDto,
  ArticleManagementListItemDto,
  ArticleManagementPageDto,
} from './article-management.model';
import {
  PaginationMeta,
  PaginationOptions,
} from '@/common/models/pagination.model';

describe('article management projections', () => {
  const article = {
    id: 'article-1',
    version: 3,
    content: { title: 'Title', summary: 'Summary', body: 'Body' },
    media: { hero: { id: 'hero-1', storage_key: 'hero.png' } },
    attribution: { author: null },
    publication: {
      status: { key: 'draft' },
      publisher: null,
      publishedAt: null,
    },
  } as ArticleEntity;
  it('exposes revisions in management detail and collection results, not public detail', () => {
    expect(new ArticleManagementDto(article).version).toBe(3);
    const item = new ArticleManagementListItemDto(article);
    const page = new ArticleManagementPageDto(
      [item],
      new PaginationMeta({
        pageOptions: new PaginationOptions(),
        itemCount: 1,
      }),
    );
    expect(page.data[0].version).toBe(3);
    expect(new ArticleDto(article)).not.toHaveProperty('version');
  });
});
