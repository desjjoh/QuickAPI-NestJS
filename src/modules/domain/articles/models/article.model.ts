import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BaseModel } from '@/common/models/base.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { ImageEntity } from '@/modules/domain/media/entities/image.entity';
import { ImageDto } from '@/modules/domain/media/models/image.model';

import { ArticleEntity } from '../entities/article.entity';
import { ArticleStatusEntity } from '../entities/articleStatus.entity';

export class ArticleImageDto {
  @ApiProperty({
    example: 'A1b2C3d4E5f6G7h8',
    description: 'Unique identifier of the image resource.',
  })
  public readonly id: string;

  @ApiProperty({
    example: 'https://assets.example.com/articles/hero.png',
    description: 'Public URL used to display the article image.',
  })
  public readonly url: string;

  @ApiProperty({
    example: 1600,
    description: 'Image width in pixels.',
  })
  public readonly width: number;

  @ApiProperty({
    example: 900,
    description: 'Image height in pixels.',
  })
  public readonly height: number;

  @ApiPropertyOptional({
    example: 'A mountain landscape at sunrise.',
    description: 'Alternative text for accessible image presentation.',
    nullable: true,
  })
  public readonly altText: string | null;

  public constructor(image: ImageEntity) {
    this.id = image.id;
    this.url = new ImageDto(image).url;
    this.width = image.width;
    this.height = image.height;
    this.altText = image.alt_text ?? null;
  }
}

/** Public user projection suitable for article bylines and publisher credits. */
export class ArticleAuthorDto {
  @ApiProperty({
    example: 'A1b2C3d4E5f6G7h8',
    description: 'Unique identifier of the credited user.',
  })
  public readonly id: string;

  @ApiProperty({
    example: 'Pat',
    description:
      'Preferred public display name, falling back to the user’s full name.',
  })
  public readonly displayName: string;

  @ApiPropertyOptional({
    type: ArticleImageDto,
    description: 'Public avatar information for the credited user.',
    nullable: true,
  })
  public readonly avatar: ArticleImageDto | null;

  public constructor(user: UserEntity) {
    const preferred = user.profile.name.preferred?.trim();

    this.id = user.id;
    this.displayName =
      preferred ||
      [user.profile.name.first, user.profile.name.last]
        .filter(Boolean)
        .join(' ');
    this.avatar = user.profile.media.avatar
      ? new ArticleImageDto(user.profile.media.avatar)
      : null;
  }
}

export class ArticleStatusDto {
  @ApiProperty({
    example: 'published',
    description: 'Stable article lifecycle status key.',
  })
  public readonly key: string;

  @ApiProperty({
    example: 'Published',
    description: 'Human-readable article lifecycle status label.',
  })
  public readonly label: string;

  public constructor(status: ArticleStatusEntity) {
    this.key = status.key;
    this.label = status.label;
  }
}

/** Compact representation intended for article collections and search results. */
export class ArticleListItemDto extends BaseModel {
  @ApiProperty({
    example: 'Building Maintainable NestJS Domains',
    description: 'Article title.',
  })
  public readonly title: string;

  @ApiProperty({
    example:
      'A practical guide to separating persistence and application logic.',
    description: 'Short article summary suitable for list presentation.',
  })
  public readonly summary: string;

  @ApiProperty({
    type: ArticleImageDto,
    description: 'Hero image used to represent the article.',
  })
  public readonly hero: ArticleImageDto;

  @ApiPropertyOptional({
    type: ArticleAuthorDto,
    description: 'Public byline information when an author is assigned.',
    nullable: true,
  })
  public readonly author: ArticleAuthorDto | null;

  @ApiProperty({
    type: ArticleStatusDto,
    description: 'Current article lifecycle status.',
  })
  public readonly status: ArticleStatusDto;

  @ApiPropertyOptional({
    example: '2026-10-08T12:00:00.000Z',
    description: 'Publication timestamp, or null before first publication.',
    nullable: true,
  })
  public readonly publishedAt: Date | null;

  public constructor(article: ArticleEntity) {
    super(article);

    this.title = article.content.title;
    this.summary = article.content.summary;
    this.hero = new ArticleImageDto(article.media.hero);
    this.author = article.attribution.author
      ? new ArticleAuthorDto(article.attribution.author)
      : null;
    this.status = new ArticleStatusDto(article.publication.status);
    this.publishedAt = article.publication.publishedAt;
  }
}

/** Complete outbound representation for a single article. */
export class ArticleDto extends ArticleListItemDto {
  @ApiProperty({
    example: 'Long-form article content…',
    description: 'Complete article body.',
  })
  public readonly body: string;

  @ApiPropertyOptional({
    type: ArticleAuthorDto,
    description: 'Public display information for the publishing user.',
    nullable: true,
  })
  public readonly publisher: ArticleAuthorDto | null;

  public constructor(article: ArticleEntity) {
    super(article);

    this.body = article.content.body;
    this.publisher = article.publication.publisher
      ? new ArticleAuthorDto(article.publication.publisher)
      : null;
  }
}
