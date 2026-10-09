import type { ArticleStatusKey } from '../seeders/status.seeder';

export interface ArticleSearchQuery {
  readonly search?: string;
}

export interface CreatorArticleQuery extends ArticleSearchQuery {
  readonly statusKey?: ArticleStatusKey;
}

export interface ArticleAdministrationQuery extends CreatorArticleQuery {
  readonly authorId?: string;
}
