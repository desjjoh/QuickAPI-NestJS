import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { Order, PaginationOptions } from '@/common/models/pagination.model';
import {
  ARTICLE_STATUS_KEYS,
  type ArticleStatusKey,
} from '../seeders/status.seeder';

export interface ArticleSearchQuery {
  readonly search?: string;
}

export interface CreatorArticleQuery extends ArticleSearchQuery {
  readonly statusKey?: ArticleStatusKey;
}

export interface ArticleAdministrationQuery extends CreatorArticleQuery {
  readonly authorId?: string;
}

/** Shared article query validation and documentation for all API audiences. */
export class ArticleQueryDto
  extends PaginationOptions
  implements ArticleSearchQuery
{
  @ApiPropertyOptional({
    maxLength: 255,
    description: 'Search text matched against article titles and summaries.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public override readonly search: string = '';

  @ApiPropertyOptional({ enum: Order, default: Order.DESC })
  @IsOptional()
  @IsEnum(Order)
  public override readonly order: Order = Order.DESC;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  public override readonly page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  public override readonly take: number = 25;
}

export class ArticleLifecycleQueryDto
  extends ArticleQueryDto
  implements CreatorArticleQuery
{
  @ApiPropertyOptional({
    enum: ARTICLE_STATUS_KEYS,
    description: 'Restricts results to one article lifecycle status.',
  })
  @IsOptional()
  @IsEnum(ARTICLE_STATUS_KEYS)
  public readonly statusKey?: ArticleStatusKey;
}
