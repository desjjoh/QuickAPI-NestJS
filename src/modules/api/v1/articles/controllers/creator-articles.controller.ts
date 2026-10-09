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
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';

import { megabyte } from '@/common/constants/bytes.constants';
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
import { storage } from '@/config/storage.config';
import {
  ArticleDto,
  ArticlePageDto,
} from '@/modules/domain/articles/models/article.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';

import { CreatorArticleQueryDto } from '../models/article-query.model';
import { CreateArticleDto } from '../models/create-article.model';
import { UpdateArticleDto } from '../models/update-article.model';
import { UpdateArticleHeroDto } from '../models/update-article-hero.model';
import { CreatorArticleApiService } from '../services/creator-articles.service';

@ApiTags('Creator Articles')
@ApiBearerAuth('access-token')
@Controller('creator')
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
  @ApiOkResponse({ type: ArticlePageDto })
  public list(
    @CurrentUser() user: UserEntity,
    @Query() query: CreatorArticleQueryDto,
  ): Promise<ArticlePageDto> {
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
  @ApiOkResponse({ type: ArticleDto })
  @ApiNotFoundResponse({
    description:
      'No article owned by the authenticated creator was found for the provided ID.',
  })
  public find(
    @CurrentUser() user: UserEntity,
    @Param('id', NanoIdParamPipe) id: string,
  ): Promise<ArticleDto> {
    return this.articles.find(user, id);
  }

  @Post('')
  @UseGuards(CsrfGuard)
  @Throttle({ default: throttlePolicies.fileUpload })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_CREATOR].CREATE_ARTICLES,
  )
  @ApiOperation({
    summary: 'Create an article draft',
    description:
      'Creates a new draft with an uploaded hero image. The authenticated creator is assigned as the author automatically.',
  })
  @ApiFileUpload({
    fieldName: 'hero',
    bodyType: CreateArticleDto,
    description:
      'Article content and hero image. The hero must be a supported image no larger than 5 MB.',
  })
  @ApiCreatedResponse({ type: ArticleDto })
  @ApiBadRequestResponse({
    description:
      'Article content or the required hero image failed validation.',
  })
  @UseInterceptors(FileInterceptor('hero', { storage }))
  public create(
    @CurrentUser() user: UserEntity,
    @Body() dto: CreateArticleDto,
    @UploadedFile(
      new ImageUploadValidationPipe({
        maxSize: 5 * megabyte,
        fileIsRequired: true,
      }),
    )
    hero: Express.Multer.File,
  ): Promise<ArticleDto> {
    return this.articles.create(user, dto, hero);
  }

  @Patch(':id')
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
  @ApiOkResponse({ type: ArticleDto })
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
  ): Promise<ArticleDto> {
    return this.articles.update(user, id, dto);
  }

  @Put(':id/hero')
  @UseGuards(CsrfGuard)
  @Throttle({ default: throttlePolicies.fileUpload })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ARTICLE_CREATOR].UPDATE_OWN_ARTICLES,
  )
  @EntityIdParam
  @ApiOperation({
    summary: 'Replace an owned article’s hero image',
    description:
      'Uploads and replaces the hero image for a draft authored by the authenticated creator. Non-draft articles cannot be changed.',
  })
  @ApiFileUpload({
    fieldName: 'hero',
    bodyType: UpdateArticleHeroDto,
    description:
      'Replacement article hero image and optional accessible alternative text. The image must be no larger than 5 MB.',
  })
  @ApiOkResponse({ type: ArticleDto })
  @ApiBadRequestResponse({ description: 'Only drafts can be updated.' })
  @ApiNotFoundResponse({
    description:
      'No article owned by the authenticated creator was found for the provided ID.',
  })
  @UseInterceptors(FileInterceptor('hero', { storage }))
  public updateHero(
    @CurrentUser() user: UserEntity,
    @Param('id', NanoIdParamPipe) id: string,
    @Body() dto: UpdateArticleHeroDto,
    @UploadedFile(
      new ImageUploadValidationPipe({
        maxSize: 5 * megabyte,
        fileIsRequired: true,
      }),
    )
    hero: Express.Multer.File,
  ): Promise<ArticleDto> {
    return this.articles.updateHero(user, id, dto, hero);
  }

  @Post(':id/submit')
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
  @ApiOkResponse({ type: ArticleDto })
  @ApiBadRequestResponse({ description: 'Only drafts can be submitted.' })
  public submit(
    @CurrentUser() user: UserEntity,
    @Param('id', NanoIdParamPipe) id: string,
  ): Promise<ArticleDto> {
    return this.articles.submit(user, id);
  }

  @Post(':id/withdraw')
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
  @ApiOkResponse({ type: ArticleDto })
  @ApiBadRequestResponse({
    description: 'Only submitted articles can be withdrawn.',
  })
  public withdraw(
    @CurrentUser() user: UserEntity,
    @Param('id', NanoIdParamPipe) id: string,
  ): Promise<ArticleDto> {
    return this.articles.withdraw(user, id);
  }
}
