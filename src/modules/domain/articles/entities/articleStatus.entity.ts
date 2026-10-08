import { Entity, OneToMany, type Relation } from 'typeorm';

import { StatusEntity } from '@/common/entities/status.entity';
import { ArticleEntity } from '../../articles/entities/article.entity';

@Entity('article_statuses')
export class ArticleStatusEntity extends StatusEntity {
  @OneToMany(
    () => ArticleEntity,
    (article: ArticleEntity) => article.publication.status,
  )
  public articles?: Relation<ArticleEntity[]>;
}
