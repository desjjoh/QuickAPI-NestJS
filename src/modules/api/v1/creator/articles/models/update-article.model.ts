import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { MaxUtf8Bytes } from '@/common/validators/max-utf8-bytes.validator';
import { ARTICLE_BODY_MAX_BYTES } from '@/modules/domain/articles/constants/article-content.constants';
import { ArticleVersionDto } from '@/modules/domain/articles/models/article-version.model';

export class UpdateArticleDto extends ArticleVersionDto {
  @ApiPropertyOptional({
    example: 'Building Maintainable NestJS Domains',
    maxLength: 255,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/\S/, { message: 'Title must contain visible text.' })
  @MaxLength(255)
  public readonly title?: string;

  @ApiPropertyOptional({
    example:
      'A practical guide to separating persistence and application logic.',
    maxLength: 255,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/\S/, { message: 'Summary must contain visible text.' })
  @MaxLength(255)
  public readonly summary?: string;

  @ApiPropertyOptional({
    example: 'Updated long-form article content…',
    maxLength: ARTICLE_BODY_MAX_BYTES,
    description:
      'Omit to retain the current body. Null is invalid. Limited to 65,535 UTF-8 bytes.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/\S/, { message: 'Body must contain visible text.' })
  @MaxUtf8Bytes(ARTICLE_BODY_MAX_BYTES)
  public readonly body?: string;
}
