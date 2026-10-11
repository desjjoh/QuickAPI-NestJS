import type { BaseEntity } from '@/common/entities/base.entity';
import type { ImageEntity } from '@/modules/domain/media/entities/image.entity';
import type { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import type { ArticleStatusEntity } from '../entities/articleStatus.entity';

/** Display-only inputs, not partially loaded persistence entities. */
export type ArticleImageRead = Pick<
  ImageEntity,
  'id' | 'storage_key' | 'width' | 'height' | 'alt_text' | 'decorative'
>;

export type ArticleAuthorRead = Pick<UserEntity, 'id'> & {
  profile: {
    name: { first: string; last: string; preferred: string | null };
    media: { avatar: ArticleImageRead | null };
  };
};

export type ArticleListRead = Pick<
  BaseEntity,
  'id' | 'createdAt' | 'updatedAt'
> & {
  version: number;
  content: { title: string; summary: string };
  media: { hero: ArticleImageRead };
  attribution: { author: ArticleAuthorRead | null };
  publication: {
    status: Pick<ArticleStatusEntity, 'key' | 'label'>;
    publishedAt: Date | null;
  };
};

export type ArticleListPage = [ArticleListRead[], number];
