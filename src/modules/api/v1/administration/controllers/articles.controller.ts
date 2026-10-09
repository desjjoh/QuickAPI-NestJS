import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { EntityIdParam } from '@/common/decorators/id-param.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import { NanoIdParamPipe } from '@/common/pipes/nanoid.pipe';
import {
  PERMISSION_MATRIX,
  PermissionDomain,
} from '@/config/permissions.config';
import { throttlePolicies } from '@/config/throttle-policy.config';
import {
  ArticleManagementDto,
  ArticleManagementPageDto,
} from '@/modules/domain/articles/models/article-management.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { ArticleVersionDto } from '@/modules/domain/articles/models/article-version.model';

import { AdministrationArticleQueryDto } from '../models/article-query.model';
import { ArticleAdministrationActionDto } from '../models/article-action.model';
import { ArticleAdministrationApiService } from '../service/articles.service';
import { Idempotent } from '@/common/decorators/idempotent.decorator';

@ApiTags('Article Administration')
@ApiBearerAuth('access-token')
@Controller('articles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Throttle({ default: throttlePolicies.administrationRead })
export class ArticleAdministrationController {
  public constructor(
    private readonly articles: ArticleAdministrationApiService,
  ) {}

  @Get('')
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_ADMINISTRATION].READ_ARTICLES,
  )
  @ApiOperation({
    summary: 'List articles for administration review',
    description:
      'Returns a paginated review queue across all article lifecycle statuses. Results may be searched, ordered, and filtered by author or status.',
  })
  @ApiOkResponse({ type: ArticleManagementPageDto })
  public list(
    @Query() query: AdministrationArticleQueryDto,
  ): Promise<ArticleManagementPageDto> {
    return this.articles.list(query);
  }

  @Get(':id')
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_ADMINISTRATION].READ_ARTICLES,
  )
  @EntityIdParam
  @ApiOperation({
    summary: 'Get article detail for administration review',
    description:
      'Returns complete article content, attribution, and publication state for an administrator reviewing a specific article.',
  })
  @ApiOkResponse({ type: ArticleManagementDto })
  @ApiNotFoundResponse({
    description: 'No article was found for the provided ID.',
  })
  public find(
    @Param('id', NanoIdParamPipe) id: string,
  ): Promise<ArticleManagementDto> {
    return this.articles.find(id);
  }

  @Post(':id/publish')
  @Idempotent('articles.publish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @Throttle({ default: throttlePolicies.administrationMutation })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_ADMINISTRATION].PUBLISH_ARTICLES,
  )
  @EntityIdParam
  @ApiOperation({
    summary: 'Publish a submitted article',
    description:
      'Transitions a submitted article to published, records the authenticated administrator as publisher, and assigns the server publication time. The hero must have descriptive alternative text or an explicit decorative choice; missing legacy text does not count as decorative.',
  })
  @ApiOkResponse({ type: ArticleManagementDto })
  @ApiBadRequestResponse({
    description:
      'Only submissions with valid hero accessibility metadata can be published.',
  })
  public publish(
    @CurrentUser() user: UserEntity,
    @Param('id', NanoIdParamPipe) id: string,
    @Body() dto: ArticleVersionDto,
  ): Promise<ArticleManagementDto> {
    return this.articles.publish(user, id, dto);
  }

  @Post(':id/return-to-draft')
  @ApiConflictResponse({
    description:
      'The expected_version is stale; reload the article before retrying.',
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @Throttle({ default: throttlePolicies.administrationMutation })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_ADMINISTRATION]
      .RETURN_ARTICLES_TO_DRAFT,
  )
  @EntityIdParam
  @ApiOperation({
    summary: 'Return a submitted article to draft',
    description:
      'Returns an article from submitted to draft so its creator can revise the content before submitting it again. A controlled administration reason is required and audited.',
  })
  @ApiOkResponse({ type: ArticleManagementDto })
  @ApiBadRequestResponse({
    description: 'Only submitted articles can be returned to draft.',
  })
  public returnToDraft(
    @CurrentUser() user: UserEntity,
    @Param('id', NanoIdParamPipe) id: string,
    @Body() dto: ArticleAdministrationActionDto,
  ): Promise<ArticleManagementDto> {
    return this.articles.returnToDraft(user, id, dto);
  }

  @Post(':id/archive')
  @Idempotent('articles.archive')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @Throttle({ default: throttlePolicies.administrationMutation })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_ADMINISTRATION].ARCHIVE_ARTICLES,
  )
  @EntityIdParam
  @ApiOperation({
    summary: 'Archive a published article',
    description:
      'Transitions a published article to archived, removing it from public article queries while retaining its publication history. A controlled administration reason is required and audited.',
  })
  @ApiOkResponse({ type: ArticleManagementDto })
  @ApiBadRequestResponse({
    description: 'Only published articles can be archived.',
  })
  public archive(
    @CurrentUser() user: UserEntity,
    @Param('id', NanoIdParamPipe) id: string,
    @Body() dto: ArticleAdministrationActionDto,
  ): Promise<ArticleManagementDto> {
    return this.articles.archive(user, id, dto);
  }

  @Post(':id/restore')
  @Idempotent('articles.restore')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @Throttle({ default: throttlePolicies.administrationMutation })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_ADMINISTRATION].RESTORE_ARTICLES,
  )
  @EntityIdParam
  @ApiOperation({
    summary: 'Restore an archived article to draft',
    description:
      'Restores an archived article to draft for further revision, clears its previous publisher and publication timestamp, and audits the required administration reason.',
  })
  @ApiOkResponse({ type: ArticleManagementDto })
  @ApiBadRequestResponse({
    description: 'Only archived articles can be restored.',
  })
  public restore(
    @CurrentUser() user: UserEntity,
    @Param('id', NanoIdParamPipe) id: string,
    @Body() dto: ArticleAdministrationActionDto,
  ): Promise<ArticleManagementDto> {
    return this.articles.restore(user, id, dto);
  }
}
