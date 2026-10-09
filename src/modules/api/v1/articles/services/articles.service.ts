import { Injectable } from '@nestjs/common';

import { PaginationMeta } from '@/common/models/pagination.model';
import { ArticleEntity } from '@/modules/domain/articles/entities/article.entity';
import {
  ArticleDto,
  ArticleListItemDto,
  ArticlePageDto,
} from '@/modules/domain/articles/models/article.model';
import { ArticleService } from '@/modules/domain/articles/services/article.service';

import { PublicArticleQueryDto } from '../models/article-query.model';

@Injectable()
export class PublicArticleApiService {
  public constructor(private readonly articles: ArticleService) {}

  public async list(query: PublicArticleQueryDto): Promise<ArticlePageDto> {
    const [articles, itemCount] = await this.articles.paginatePublished(query, {
      search: query.search,
    });
    const data = articles.map(
      (article: ArticleEntity) => new ArticleListItemDto(article),
    );

    return new ArticlePageDto(
      data,
      new PaginationMeta({ pageOptions: query, itemCount }),
    );
  }

  public async find(id: string): Promise<ArticleDto> {
    return new ArticleDto(await this.articles.findPublishedByIdOrFail(id));
  }
}
