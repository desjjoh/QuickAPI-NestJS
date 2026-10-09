import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { EntityIdParam } from '@/common/decorators/id-param.decorator';
import { NanoIdParamPipe } from '@/common/pipes/nanoid.pipe';
import { throttlePolicies } from '@/config/throttle-policy.config';
import {
  ArticleDto,
  ArticlePageDto,
} from '@/modules/domain/articles/models/article.model';

import { PublicArticleQueryDto } from '../models/article-query.model';
import { PublicArticleApiService } from '../services/articles.service';

@ApiTags('Articles')
@Controller('')
@Throttle({ default: throttlePolicies.publicRead })
export class PublicArticleController {
  public constructor(private readonly articles: PublicArticleApiService) {}

  @Get('')
  @ApiOperation({
    summary: 'List published articles',
    description:
      'Returns a paginated collection containing only publicly published articles.',
  })
  @ApiOkResponse({ type: ArticlePageDto })
  public list(@Query() query: PublicArticleQueryDto): Promise<ArticlePageDto> {
    return this.articles.list(query);
  }

  @Get(':id')
  @EntityIdParam
  @ApiOperation({
    summary: 'Get a published article',
    description:
      'Returns article detail only when the requested article is publicly published.',
  })
  @ApiOkResponse({ type: ArticleDto })
  @ApiNotFoundResponse({
    description: 'No published article was found for the provided ID.',
  })
  public find(@Param('id', NanoIdParamPipe) id: string): Promise<ArticleDto> {
    return this.articles.find(id);
  }
}
