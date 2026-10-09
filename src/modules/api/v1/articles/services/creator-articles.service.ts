import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { PaginationMeta } from '@/common/models/pagination.model';
import {
  ArticleAuditEvents,
  AuditActorType,
  AuditEventDomain,
  AuditResourceType,
  AuditSource,
  AuditSubjectType,
} from '@/config/audit-events.config';
import { ArticleEntity } from '@/modules/domain/articles/entities/article.entity';
import {
  ArticleDto,
  ArticleListItemDto,
  ArticlePageDto,
} from '@/modules/domain/articles/models/article.model';
import { ArticleService } from '@/modules/domain/articles/services/article.service';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import { articleAuditSnapshot } from '@/modules/domain/audit/snapshots/article-audit.snapshot';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { ImageEntity } from '@/modules/domain/media/entities/image.entity';

import { CreateArticleDto } from '../models/create-article.model';
import { CreatorArticleQueryDto } from '../models/article-query.model';
import { UpdateArticleDto } from '../models/update-article.model';
import { UpdateArticleHeroDto } from '../models/update-article-hero.model';

@Injectable()
export class CreatorArticleApiService {
  public constructor(
    private readonly articles: ArticleService,
    private readonly audit: AuditService,
  ) {}

  public async list(
    user: UserEntity,
    query: CreatorArticleQueryDto,
  ): Promise<ArticlePageDto> {
    const [articles, itemCount] = await this.articles.paginateByAuthor(
      user.id,
      query,
      { search: query.search, statusKey: query.statusKey },
    );
    const data = articles.map(
      (article: ArticleEntity) => new ArticleListItemDto(article),
    );

    return new ArticlePageDto(
      data,
      new PaginationMeta({ pageOptions: query, itemCount }),
    );
  }

  public async find(user: UserEntity, id: string): Promise<ArticleDto> {
    return new ArticleDto(
      await this.articles.findByIdAndAuthorOrFail(id, user.id),
    );
  }

  public async create(
    user: UserEntity,
    dto: CreateArticleDto,
    hero: Express.Multer.File,
  ): Promise<ArticleDto> {
    const article = await this.articles.transaction(async (manager) => {
      const created = await this.articles.createWithHero(
        {
          content: {
            title: dto.title,
            summary: dto.summary,
            body: dto.body,
          },
          authorId: user.id,
          hero: {
            file: hero,
            altText: dto.hero_alt_text,
            folder: `articles/${user.id}/heroes`,
          },
        },
        manager,
      );
      await this.record(
        ArticleAuditEvents.CREATED,
        user,
        created,
        null,
        articleAuditSnapshot(created),
        manager,
      );
      return created;
    });

    return new ArticleDto(article);
  }

  public async update(
    user: UserEntity,
    id: string,
    dto: UpdateArticleDto,
  ): Promise<ArticleDto> {
    if (
      dto.title === undefined &&
      dto.summary === undefined &&
      dto.body === undefined
    )
      throw new BadRequestException('At least one article field is required.');

    const article = await this.articles.transaction(async (manager) => {
      const current = await this.articles.findByIdAndAuthorForUpdateOrFail(
        id,
        user.id,
        manager,
      );

      const updated = await this.articles.update(
        current,
        {
          content: {
            title: dto.title,
            summary: dto.summary,
            body: dto.body,
          },
        },
        manager,
      );
      await this.record(
        ArticleAuditEvents.UPDATED,
        user,
        updated,
        articleAuditSnapshot(current),
        articleAuditSnapshot(updated),
        manager,
      );
      return updated;
    });

    return new ArticleDto(article);
  }

  public async updateHero(
    user: UserEntity,
    id: string,
    dto: UpdateArticleHeroDto,
    file: Express.Multer.File,
  ): Promise<ArticleDto> {
    const article = await this.articles.transaction(async (manager) => {
      const current = await this.articles.findByIdAndAuthorForUpdateOrFail(
        id,
        user.id,
        manager,
      );
      const before = this.imageSnapshot(current.media.hero);
      const updated = await this.articles.updateHero(
        current,
        {
          file,
          altText: dto.hero_alt_text,
          folder: `articles/${user.id}/heroes`,
        },
        manager,
      );
      const image = updated.media.hero;

      await this.audit.record(
        {
          domain: AuditEventDomain.ARTICLES,
          event: ArticleAuditEvents.HERO_REPLACED,
          actorType: AuditActorType.USER,
          actorId: user.id,
          subjectType: AuditSubjectType.ARTICLE,
          subjectId: updated.id,
          resourceType: AuditResourceType.MEDIA_IMAGE,
          resourceId: image.id,
          source: AuditSource.HTTP,
          metadata: {},
          before,
          after: this.imageSnapshot(image),
          meaningfulWithoutChanges: true,
        },
        manager,
      );

      return updated;
    });

    return new ArticleDto(article);
  }

  public submit(user: UserEntity, id: string): Promise<ArticleDto> {
    return this.transitionOwned(user, id, 'submit');
  }

  public withdraw(user: UserEntity, id: string): Promise<ArticleDto> {
    return this.transitionOwned(user, id, 'withdraw');
  }

  private async transitionOwned(
    user: UserEntity,
    id: string,
    action: 'submit' | 'withdraw',
  ): Promise<ArticleDto> {
    const article = await this.articles.transaction(async (manager) => {
      const current = await this.articles.findByIdAndAuthorForUpdateOrFail(
        id,
        user.id,
        manager,
      );

      const updated = await (action === 'submit'
        ? this.articles.submit(current, manager)
        : this.articles.withdraw(current, manager));
      await this.record(
        action === 'submit'
          ? ArticleAuditEvents.SUBMITTED
          : ArticleAuditEvents.WITHDRAWN,
        user,
        updated,
        articleAuditSnapshot(current),
        articleAuditSnapshot(updated),
        manager,
      );
      return updated;
    });

    return new ArticleDto(article);
  }

  private record(
    event: ArticleAuditEvents,
    user: UserEntity,
    article: ArticleEntity,
    before: unknown,
    after: unknown,
    manager: EntityManager,
  ) {
    return this.audit.record(
      {
        domain: AuditEventDomain.ARTICLES,
        event,
        actorType: AuditActorType.USER,
        actorId: user.id,
        subjectType: AuditSubjectType.ARTICLE,
        subjectId: article.id,
        resourceType: AuditResourceType.ARTICLES_ARTICLE,
        resourceId: article.id,
        source: AuditSource.HTTP,
        metadata: {},
        before,
        after,
      },
      manager,
    );
  }

  private imageSnapshot(image: ImageEntity): Record<string, unknown> {
    return {
      id: image.id,
      filename: image.filename,
      mime_type: image.mime_type,
      size_bytes: image.size_bytes,
      width: image.width,
      height: image.height,
      alt_text: image.alt_text ?? null,
      created_at: image.createdAt,
      updated_at: image.updatedAt,
    };
  }
}
