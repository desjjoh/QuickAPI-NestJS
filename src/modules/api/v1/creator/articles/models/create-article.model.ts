import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { MaxUtf8Bytes } from '@/common/validators/max-utf8-bytes.validator';
import { ARTICLE_BODY_MAX_BYTES } from '@/modules/domain/articles/constants/article-content.constants';

import { HeroAccessibilityDto } from './hero-accessibility.model';

export class CreateArticleDto extends HeroAccessibilityDto {
  @ApiProperty({
    example: 'Building Maintainable NestJS Domains',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Title must contain visible text.' })
  @MaxLength(255)
  public readonly title!: string;

  @ApiProperty({
    example:
      'A practical guide to separating persistence and application logic.',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Summary must contain visible text.' })
  @MaxLength(255)
  public readonly summary!: string;

  @ApiProperty({
    example: 'Long-form article content…',
    maxLength: ARTICLE_BODY_MAX_BYTES,
    description: 'Required non-null content, limited to 65,535 UTF-8 bytes.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Body must contain visible text.' })
  @MaxUtf8Bytes(ARTICLE_BODY_MAX_BYTES)
  public readonly body!: string;
}
