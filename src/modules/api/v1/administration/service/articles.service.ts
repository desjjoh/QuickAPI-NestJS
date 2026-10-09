import { Injectable } from '@nestjs/common';
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
  ArticleManagementDto,
  ArticleManagementListItemDto,
  ArticleManagementPageDto,
} from '@/modules/domain/articles/models/article-management.model';
import { ArticleService } from '@/modules/domain/articles/services/article.service';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import { articleAuditSnapshot } from '@/modules/domain/audit/snapshots/article-audit.snapshot';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { ArticleVersionDto } from '@/modules/domain/articles/models/article-version.model';
import { assertArticleVersion } from '@/modules/domain/articles/policies/article-version.policy';

import { ArticleAdministrationActionDto } from '../models/article-action.model';
import { AdministrationArticleQueryDto } from '../models/article-query.model';

type AdministrationArticleAction =
  | 'publish'
  | 'returnToDraft'
  | 'archive'
  | 'restore';

@Injectable()
export class ArticleAdministrationApiService {
  public constructor(
    private readonly articles: ArticleService,
    private readonly audit: AuditService,
  ) {}

  public async list(
    query: AdministrationArticleQueryDto,
  ): Promise<ArticleManagementPageDto> {
    const [articles, itemCount] = await this.articles.paginateForAdministration(
      query,
      {
        search: query.search,
        statusKey: query.statusKey,
        authorId: query.authorId,
      },
    );
    const data = articles.map(
      (article: ArticleEntity) => new ArticleManagementListItemDto(article),
    );

    return new ArticleManagementPageDto(
      data,
      new PaginationMeta({ pageOptions: query, itemCount }),
    );
  }

  public async find(id: string): Promise<ArticleManagementDto> {
    return new ArticleManagementDto(await this.articles.findByIdOrFail(id));
  }

  public publish(
    user: UserEntity,
    id: string,
    dto: ArticleVersionDto,
  ): Promise<ArticleManagementDto> {
    return this.transition(user, id, 'publish', dto.expected_version);
  }

  public returnToDraft(
    user: UserEntity,
    id: string,
    dto: ArticleAdministrationActionDto,
  ): Promise<ArticleManagementDto> {
    return this.transition(
      user,
      id,
      'returnToDraft',
      dto.expected_version,
      dto.reason_code,
    );
  }

  public archive(
    user: UserEntity,
    id: string,
    dto: ArticleAdministrationActionDto,
  ): Promise<ArticleManagementDto> {
    return this.transition(
      user,
      id,
      'archive',
      dto.expected_version,
      dto.reason_code,
    );
  }

  public restore(
    user: UserEntity,
    id: string,
    dto: ArticleAdministrationActionDto,
  ): Promise<ArticleManagementDto> {
    return this.transition(
      user,
      id,
      'restore',
      dto.expected_version,
      dto.reason_code,
    );
  }

  private async transition(
    user: UserEntity,
    id: string,
    action: AdministrationArticleAction,
    expectedVersion: number,
    reasonCode?: string,
  ): Promise<ArticleManagementDto> {
    const article = await this.articles.transaction(async (manager) => {
      const current = await this.articles.findByIdForUpdateOrFail(id, manager);
      assertArticleVersion(current, expectedVersion);
      const updated = await this.applyAction(action, current, user.id, manager);
      await this.audit.record(
        {
          domain: AuditEventDomain.ARTICLES,
          event: this.auditEvent(action),
          actorType: AuditActorType.ADMIN,
          actorId: user.id,
          subjectType: AuditSubjectType.ARTICLE,
          subjectId: updated.id,
          resourceType: AuditResourceType.ARTICLES_ARTICLE,
          resourceId: updated.id,
          source: AuditSource.HTTP,
          metadata: reasonCode ? { reason_code: reasonCode } : {},
          before: articleAuditSnapshot(current),
          after: articleAuditSnapshot(updated),
        },
        manager,
      );
      return updated;
    });

    return new ArticleManagementDto(article);
  }

  private applyAction(
    action: AdministrationArticleAction,
    article: ArticleEntity,
    administratorId: string,
    manager: EntityManager,
  ): Promise<ArticleEntity> {
    switch (action) {
      case 'publish':
        return this.articles.publish(
          article,
          administratorId,
          new Date(),
          manager,
        );
      case 'returnToDraft':
        return this.articles.returnToDraft(article, manager);
      case 'archive':
        return this.articles.archive(article, manager);
      case 'restore':
        return this.articles.restore(article, manager);
    }
  }

  private auditEvent(action: AdministrationArticleAction): ArticleAuditEvents {
    switch (action) {
      case 'publish':
        return ArticleAuditEvents.PUBLISHED;
      case 'returnToDraft':
        return ArticleAuditEvents.RETURNED_TO_DRAFT;
      case 'archive':
        return ArticleAuditEvents.ARCHIVED;
      case 'restore':
        return ArticleAuditEvents.RESTORED;
    }
  }
}
