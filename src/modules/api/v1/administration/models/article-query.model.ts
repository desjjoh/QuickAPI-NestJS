import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

import { ArticleLifecycleQueryDto } from '@/modules/domain/articles/models/article-query.model';

export class AdministrationArticleQueryDto extends ArticleLifecycleQueryDto {
  @ApiPropertyOptional({
    description: 'Restricts results to articles assigned to one author.',
    minLength: 16,
    maxLength: 16,
    pattern: '^[0-9A-Za-z]{16}$',
  })
  @IsOptional()
  @IsString()
  @Length(16, 16)
  @Matches(/^[0-9A-Za-z]{16}$/, {
    message: 'Author ID must contain only letters and numbers.',
  })
  public readonly authorId?: string;
}
