import { Column, Entity, JoinColumn, ManyToOne, type Relation } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';

import { ImageEntity } from '../../media/entities/image.entity';
import { UserEntity } from '../../identity/entities/user.entity';
import { ArticleStatusEntity } from './articleStatus.entity';

class Content {
  @Column({ type: 'varchar', length: 255 })
  public readonly title!: string;

  @Column({ type: 'varchar', length: 255 })
  public readonly summary!: string;

  @Column({ type: 'text' })
  public readonly body!: string;
}

class Media {
  @ManyToOne(() => ImageEntity, {
    eager: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'hero_id', referencedColumnName: 'id' })
  public readonly hero!: Relation<ImageEntity>;
}

class Attribution {
  @ManyToOne(() => UserEntity, {
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'author_id', referencedColumnName: 'id' })
  public readonly author!: Relation<UserEntity | null>;
}

class Publication {
  @ManyToOne(
    () => ArticleStatusEntity,
    (status: ArticleStatusEntity) => status.articles,
    {
      eager: true,
      nullable: false,
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({ name: 'status_id', referencedColumnName: 'id' })
  public readonly status!: Relation<ArticleStatusEntity>;

  @ManyToOne(() => UserEntity, {
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'publisher_id', referencedColumnName: 'id' })
  public readonly publisher!: Relation<UserEntity | null>;

  @Column({ type: 'datetime', nullable: true })
  public readonly publishedAt!: Date | null;
}

@Entity('articles')
export class ArticleEntity extends BaseEntity {
  public constructor() {
    super();

    this.content = new Content();
    this.media = new Media();
    this.attribution = new Attribution();
    this.publication = new Publication();
  }

  @Column(() => Content, { prefix: false })
  public readonly content!: Content;

  @Column(() => Media, { prefix: false })
  public readonly media!: Media;

  @Column(() => Attribution, { prefix: false })
  public readonly attribution!: Attribution;

  @Column(() => Publication, { prefix: false })
  public readonly publication!: Publication;
}
