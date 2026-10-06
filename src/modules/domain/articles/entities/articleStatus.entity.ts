import { Column, Entity, Index, OneToMany, type Relation } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';
import { ArticleEntity } from './article.entity';

@Entity('article_statuses')
export class ArticleStatusEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  public key!: string;

  @Column({ type: 'text' })
  public label!: string;

  @Column({ type: 'text', nullable: true })
  public description!: string | null;

  @OneToMany(
    () => ArticleEntity,
    (article: ArticleEntity) => article.publication.status,
  )
  public articles?: Relation<ArticleEntity[]>;
}
