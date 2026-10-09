import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnprocessableEntityResponse,
  ApiTags,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ImageFileInterceptor } from '@/common/interceptors/image-file.interceptor';

import { imageUploadPolicy } from '@/config/image-upload.config';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiFileUpload } from '@/common/decorators/file-upload.decorator';
import { EntityIdParam } from '@/common/decorators/id-param.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import { NanoIdParamPipe } from '@/common/pipes/nanoid.pipe';
import { ImageUploadValidationPipe } from '@/common/pipes/image-upload.pipe';
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

import { CreatorArticleQueryDto } from '../models/article-query.model';
import { CreateArticleDto } from '../models/create-article.model';
import { UpdateArticleDto } from '../models/update-article.model';
import { UpdateArticleHeroDto } from '../models/update-article-hero.model';
import { CreatorArticleApiService } from '../services/articles.service';
import { Idempotent } from '@/common/decorators/idempotent.decorator';

@ApiTags('Creator Articles')
@ApiBearerAuth('access-token')
@Controller('articles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Throttle({ default: throttlePolicies.publicRead })
export class CreatorArticleController {
  public constructor(private readonly articles: CreatorArticleApiService) {}

  @Get('')
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_CREATOR].READ_OWN_ARTICLES,
  )
  @ApiOperation({
    summary: 'List the authenticated creator’s articles',
    description:
      'Returns a paginated collection of articles authored by the authenticated creator. Results may be searched, ordered, and filtered by lifecycle status.',
  })
  @ApiOkResponse({ type: ArticleManagementPageDto })
  public list(
    @CurrentUser() user: UserEntity,
    @Query() query: CreatorArticleQueryDto,
  ): Promise<ArticleManagementPageDto> {
    return this.articles.list(user, query);
  }

  @Get(':id')
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_CREATOR].READ_OWN_ARTICLES,
  )
  @EntityIdParam
  @ApiOperation({
    summary: 'Get an article owned by the creator',
    description:
      'Returns complete article detail when the requested article is authored by the authenticated creator. Articles owned by another account are not disclosed.',
  })
  @ApiOkResponse({ type: ArticleManagementDto })
  @ApiNotFoundResponse({
    description:
      'No article owned by the authenticated creator was found for the provided ID.',
  })
  public find(
    @CurrentUser() user: UserEntity,
    @Param('id', NanoIdParamPipe) id: string,
  ): Promise<ArticleManagementDto> {
    return this.articles.find(user, id);
  }

  @Post('')
  @Idempotent('articles.create')
  @UseGuards(CsrfGuard)
  @Throttle({ default: throttlePolicies.fileUpload })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_CREATOR].CREATE_ARTICLES,
  )
  @ApiOperation({
    summary: 'Create an article draft',
    description:
      'Creates a new draft with an uploaded hero image and a required accessibility choice: descriptive hero_alt_text, or hero_decorative=true with no text. The authenticated creator is assigned as the author automatically.',
  })
  @ApiFileUpload({
    fieldName: 'hero',
    bodyType: CreateArticleDto,
    description:
      'Article content and a PNG, JPEG, or GIF hero no larger than 5 MB, 8192 pixels per side, or 40 million pixels across all frames.',
  })
  @ApiCreatedResponse({ type: ArticleManagementDto })
  @ApiUnprocessableEntityResponse({
    description:
      'Article content or hero accessibility metadata failed validation.',
  })
  @ApiBadRequestResponse({
    description:
      'Article content or the required hero image failed validation.',
  })
  @UseInterceptors(ImageFileInterceptor('hero', imageUploadPolicy.heroMaxBytes))
  public create(
    @CurrentUser() user: UserEntity,
    @Body() dto: CreateArticleDto,
    @UploadedFile(
      new ImageUploadValidationPipe({
        maxSize: imageUploadPolicy.heroMaxBytes,
        fileIsRequired: true,
      }),
    )
    hero: Express.Multer.File,
  ): Promise<ArticleManagementDto> {
    return this.articles.create(user, dto, hero);
  }

  @Patch(':id')
  @ApiConflictResponse({
    description:
      'The expected_version is stale; reload the article before retrying.',
  })
  @UseGuards(CsrfGuard)
  @Throttle({ default: throttlePolicies.articleMutation })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_CREATOR].UPDATE_OWN_ARTICLES,
  )
  @EntityIdParam
  @ApiOperation({
    summary: 'Update an owned article draft',
    description:
      'Updates one or more editable fields on a draft authored by the authenticated creator. Submitted, published, and archived articles cannot be edited.',
  })
  @ApiOkResponse({ type: ArticleManagementDto })
  @ApiBadRequestResponse({
    description:
      'The article is not a draft or no update fields were supplied.',
  })
  @ApiNotFoundResponse({
    description:
      'No article owned by the authenticated creator was found for the provided ID.',
  })
  public update(
    @CurrentUser() user: UserEntity,
    @Param('id', NanoIdParamPipe) id: string,
    @Body() dto: UpdateArticleDto,
  ): Promise<ArticleManagementDto> {
    return this.articles.update(user, id, dto);
  }

  @Put(':id/hero')
  @Idempotent('articles.hero.replace')
  @UseGuards(CsrfGuard)
  @Throttle({ default: throttlePolicies.fileUpload })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_CREATOR].UPDATE_OWN_ARTICLES,
  )
  @EntityIdParam
  @ApiOperation({
    summary: 'Replace an owned article’s hero image',
    description:
      'Uploads and replaces the hero image for a draft authored by the authenticated creator. Each replacement requires fresh descriptive hero_alt_text or hero_decorative=true with no text; old text is never retained. Non-draft articles cannot be changed.',
  })
  @ApiFileUpload({
    fieldName: 'hero',
    bodyType: UpdateArticleHeroDto,
    description:
      'Replacement PNG, JPEG, or GIF hero with descriptive alternative text or an explicit decorative choice. Maximum 5 MB, 8192 pixels per side, and 40 million pixels across all frames.',
  })
  @ApiOkResponse({ type: ArticleManagementDto })
  @ApiBadRequestResponse({ description: 'Only drafts can be updated.' })
  @ApiUnprocessableEntityResponse({
    description: 'Hero accessibility metadata failed validation.',
  })
  @ApiNotFoundResponse({
    description:
      'No article owned by the authenticated creator was found for the provided ID.',
  })
  @UseInterceptors(ImageFileInterceptor('hero', imageUploadPolicy.heroMaxBytes))
  public updateHero(
    @CurrentUser() user: UserEntity,
    @Param('id', NanoIdParamPipe) id: string,
    @Body() dto: UpdateArticleHeroDto,
    @UploadedFile(
      new ImageUploadValidationPipe({
        maxSize: imageUploadPolicy.heroMaxBytes,
        fileIsRequired: true,
      }),
    )
    hero: Express.Multer.File,
  ): Promise<ArticleManagementDto> {
    return this.articles.updateHero(user, id, dto, hero);
  }

  @Post(':id/submit')
  @ApiConflictResponse({
    description:
      'The expected_version is stale; reload the article before retrying.',
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @Throttle({ default: throttlePolicies.articleMutation })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_CREATOR].SUBMIT_OWN_ARTICLES,
  )
  @EntityIdParam
  @ApiOperation({
    summary: 'Submit an owned draft for review',
    description:
      'Transitions an article authored by the authenticated creator from draft to submitted so it can enter the administration review queue.',
  })
  @ApiOkResponse({ type: ArticleManagementDto })
  @ApiBadRequestResponse({ description: 'Only drafts can be submitted.' })
  public submit(
    @CurrentUser() user: UserEntity,
    @Param('id', NanoIdParamPipe) id: string,
    @Body() dto: ArticleVersionDto,
  ): Promise<ArticleManagementDto> {
    return this.articles.submit(user, id, dto);
  }

  @Post(':id/withdraw')
  @ApiConflictResponse({
    description:
      'The expected_version is stale; reload the article before retrying.',
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @Throttle({ default: throttlePolicies.articleMutation })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_CREATOR].WITHDRAW_OWN_ARTICLES,
  )
  @EntityIdParam
  @ApiOperation({
    summary: 'Withdraw an owned submission to draft',
    description:
      'Withdraws an article authored by the authenticated creator from administration review and returns it from submitted to draft.',
  })
  @ApiOkResponse({ type: ArticleManagementDto })
  @ApiBadRequestResponse({
    description: 'Only submitted articles can be withdrawn.',
  })
  public withdraw(
    @CurrentUser() user: UserEntity,
    @Param('id', NanoIdParamPipe) id: string,
    @Body() dto: ArticleVersionDto,
  ): Promise<ArticleManagementDto> {
    return this.articles.withdraw(user, id, dto);
  }
}
