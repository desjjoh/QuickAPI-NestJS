import { ArticleEntity } from '@/modules/domain/articles/entities/article.entity';

const timestamp = (value: Date | null | undefined): string | null =>
  value instanceof Date ? value.toISOString() : null;

/** Builds a detached article value without traversing user or media relations. */
export const articleAuditSnapshot = (
  article: ArticleEntity,
): Record<string, unknown> => ({
  id: article.id,
  content: {
    title: article.content.title,
    summary: article.content.summary,
    body: article.content.body,
  },
  media: { hero_id: article.media.hero.id },
  attribution: { author_id: article.attribution.author?.id ?? null },
  publication: {
    status: {
      id: article.publication.status.id,
      key: article.publication.status.key,
    },
    publisher_id: article.publication.publisher?.id ?? null,
    published_at: timestamp(article.publication.publishedAt),
  },
  created_at: timestamp(article.createdAt),
  updated_at: timestamp(article.updatedAt),
});
