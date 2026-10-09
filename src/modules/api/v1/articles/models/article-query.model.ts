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
import { ARTICLE_STATUS_KEYS } from '@/modules/domain/articles/seeders/status.seeder';
import type { ArticleStatusKey } from '@/modules/domain/articles/seeders/status.seeder';

export class PublicArticleQueryDto extends PaginationOptions {
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

export class CreatorArticleQueryDto extends PublicArticleQueryDto {
  @ApiPropertyOptional({
    enum: ARTICLE_STATUS_KEYS,
    description: 'Restricts results to one article lifecycle status.',
  })
  @IsOptional()
  @IsEnum(ARTICLE_STATUS_KEYS)
  public readonly statusKey?: ArticleStatusKey;
}
