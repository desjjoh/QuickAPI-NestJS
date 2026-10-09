import { ApiProperty } from '@nestjs/swagger';
import { ArticleEntity } from '../entities/article.entity';
import {
  ArticleDto,
  ArticleListItemDto,
  ArticlePageDto,
} from './article.model';
import { PaginationMeta } from '@/common/models/pagination.model';

export class ArticleManagementListItemDto extends ArticleListItemDto {
  @ApiProperty({
    minimum: 1,
    description:
      'Current article revision; send as expected_version for mutations.',
  })
  public readonly version: number;

  public constructor(article: ArticleEntity) {
    super(article);
    this.version = article.version;
  }
}

export class ArticleManagementDto extends ArticleDto {
  @ApiProperty({
    minimum: 1,
    description:
      'Current article revision; send as expected_version for mutations.',
  })
  public readonly version: number;

  public constructor(article: ArticleEntity) {
    super(article);
    this.version = article.version;
  }
}

export class ArticleManagementPageDto extends ArticlePageDto {
  @ApiProperty({ type: ArticleManagementListItemDto, isArray: true })
  public override readonly data: ArticleManagementListItemDto[];

  public constructor(
    data: ArticleManagementListItemDto[],
    meta: PaginationMeta,
  ) {
    super(data, meta);
    this.data = data;
  }
}
