import { HeroAccessibilityDto } from './hero-accessibility.model';
import { IntersectionType } from '@nestjs/swagger';
import { ArticleVersionDto } from '@/modules/domain/articles/models/article-version.model';

export class UpdateArticleHeroDto extends IntersectionType(
  HeroAccessibilityDto,
  ArticleVersionDto,
) {}
