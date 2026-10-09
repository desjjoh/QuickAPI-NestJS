import { IntersectionType } from '@nestjs/swagger';
import { ArticleVersionDto } from '@/modules/domain/articles/models/article-version.model';
import { AdministrationActionDto } from './administration-action.model';

export class ArticleAdministrationActionDto extends IntersectionType(
  AdministrationActionDto,
  ArticleVersionDto,
) {}
