import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DeepPartial, EntityManager } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { omitUndefinedDeep } from '@/common/helpers/typing.helper';
import {
  runInTransaction,
  TransactionLifecycle,
  type TransactionWork,
} from '@/common/helpers/transaction.helper';
import { PaginationOptions } from '@/common/models/pagination.model';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { ImageService } from '@/modules/domain/media/services/image.service';

import { ArticleEntity } from '../entities/article.entity';
import { ArticleStatusEntity } from '../entities/articleStatus.entity';
import { ArticleRepository } from '../repositories/article.repository';
import { ArticleStatusRepository } from '../repositories/status.repository';
import { ArticleStatusTransitionPolicy } from '../policies/article-status-transition.policy';
import { resolveHeroAccessibility } from '../policies/hero-accessibility.policy';
import { assertArticleVersion } from '../policies/article-version.policy';
import {
  ArticleAdministrationQuery,
  ArticleSearchQuery,
  CreatorArticleQuery,
} from '../models/article-query.model';
import {
  ARTICLE_STATUS_KEYS,
  ArticleStatusKey,
} from '../seeders/status.seeder';

export type ArticleContentInput = {
  title: string;
  summary: string;
  body: string;
};

export type CreateArticleInput = {
  content: ArticleContentInput;
  heroId: string;
  authorId?: string | null;
};

export type CreateArticleWithHeroInput = Omit<CreateArticleInput, 'heroId'> & {
  hero: {
    file: Express.Multer.File;
    folder: string;
    altText?: string | null;
    decorative?: boolean;
  };
};

export type UpdateArticleInput = {
  content?: Partial<ArticleContentInput>;
  heroId?: string;
  authorId?: string | null;
};

export type UpdateArticleHeroInput = {
  file: Express.Multer.File;
  folder: string;
  altText?: string | null;
  decorative?: boolean;
};

@Injectable()
export class ArticleService {
  public constructor(
    private readonly articleRepo: ArticleRepository,
    private readonly statusRepo: ArticleStatusRepository,
    private readonly imageSvc: ImageService,
    private readonly userSvc: UserService,
    private readonly transitionPolicy: ArticleStatusTransitionPolicy,
  ) {}

  public transaction<T>(work: TransactionWork<T>): Promise<T> {
    return runInTransaction(this.articleRepo.manager, work);
  }

  public findAll(
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity[]> {
    return this.articleRepo.findAll(manager);
  }

  public async findByIdOrFail(
    id: string,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity> {
    const article = await this.articleRepo.findById(manager, id);

    if (!article) throw new NotFoundException('Article not found.');

    return article;
  }

  public findPublished(
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity[]> {
    return this.articleRepo.findByStatusKey(
      manager,
      ARTICLE_STATUS_KEYS.PUBLISHED,
    );
  }

  public paginatePublished(
    pageOptions: PaginationOptions,
    query: ArticleSearchQuery = {},
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<[ArticleEntity[], number]> {
    return this.articleRepo.paginatePublished(manager, pageOptions, query);
  }

  public async findPublishedByIdOrFail(
    id: string,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity> {
    const article = await this.articleRepo.findPublishedById(manager, id);

    if (!article) throw new NotFoundException('Article not found.');

    return article;
  }

  public paginateByAuthor(
    authorId: string,
    pageOptions: PaginationOptions,
    query: CreatorArticleQuery = {},
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<[ArticleEntity[], number]> {
    return this.articleRepo.paginateByAuthor(
      manager,
      authorId,
      pageOptions,
      query,
    );
  }

  public async findByIdAndAuthorOrFail(
    id: string,
    authorId: string,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity> {
    const article = await this.articleRepo.findByIdAndAuthor(
      manager,
      id,
      authorId,
    );

    if (!article) throw new NotFoundException('Article not found.');

    return article;
  }

  public async findByIdAndAuthorForUpdateOrFail(
    id: string,
    authorId: string,
    manager: EntityManager,
  ): Promise<ArticleEntity> {
    const article = await this.articleRepo.findByIdAndAuthorForUpdate(
      manager,
      id,
      authorId,
    );

    if (!article) throw new NotFoundException('Article not found.');

    return article;
  }

  public paginateForAdministration(
    pageOptions: PaginationOptions,
    query: ArticleAdministrationQuery = {},
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<[ArticleEntity[], number]> {
    return this.articleRepo.paginateForAdministration(
      manager,
      pageOptions,
      query,
    );
  }

  public async findByIdForUpdateOrFail(
    id: string,
    manager: EntityManager,
  ): Promise<ArticleEntity> {
    const article = await this.articleRepo.findByIdForUpdate(manager, id);

    if (!article) throw new NotFoundException('Article not found.');

    return article;
  }

  public findByAuthor(
    authorId: string,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity[]> {
    return this.articleRepo.findByAuthorId(manager, authorId);
  }

  public async findByStatus(
    statusKey: ArticleStatusKey,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity[]> {
    await this.getStatus(statusKey, manager);
    return this.articleRepo.findByStatusKey(manager, statusKey);
  }

  public findStatuses(
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleStatusEntity[]> {
    return this.statusRepo.findAll(manager);
  }

  public async findStatusByIdOrFail(
    id: string,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleStatusEntity> {
    const status = await this.statusRepo.findById(manager, id);

    if (!status) throw new NotFoundException('Article status not found.');

    return status;
  }

  public async create(
    input: CreateArticleInput,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity> {
    const [draft, hero, author] = await Promise.all([
      this.getStatus(ARTICLE_STATUS_KEYS.DRAFT, manager),
      this.imageSvc.findById(input.heroId, manager),
      input.authorId !== undefined && input.authorId !== null
        ? this.userSvc.findByIdOrFail(input.authorId, manager)
        : Promise.resolve(null),
    ]);
    const article = manager.create(ArticleEntity, {
      content: { ...input.content },
      media: { hero: { id: hero.id } },
      attribution: { author: author ? { id: author.id } : null },
      publication: {
        status: { id: draft.id },
        publisher: null,
        publishedAt: null,
      },
    });
    const created = await manager.save(ArticleEntity, article);

    return this.findByIdOrFail(created.id, manager);
  }

  public async createWithHero(
    input: CreateArticleWithHeroInput,
    manager: EntityManager = this.articleRepo.manager,
    lifecycle?: TransactionLifecycle,
  ): Promise<ArticleEntity> {
    if (!lifecycle)
      return runInTransaction(
        manager,
        (transactionManager, transactionLifecycle) =>
          this.createWithHero(input, transactionManager, transactionLifecycle),
      );

    const accessibility = resolveHeroAccessibility(
      input.hero.altText,
      input.hero.decorative,
    );
    const image = await this.imageSvc.create(
      {
        file: input.hero.file,
        folder: input.hero.folder,
        alt_text: accessibility.altText,
        decorative: accessibility.decorative,
      },
      manager,
      lifecycle,
    );

    return this.create(
      {
        content: input.content,
        authorId: input.authorId,
        heroId: image.id,
      },
      manager,
    );
  }

  public async update(
    article: ArticleEntity,
    input: UpdateArticleInput,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity> {
    this.transitionPolicy.assertEditable(article.publication.status.key);

    const [hero, author] = await Promise.all([
      input.heroId !== undefined
        ? this.imageSvc.findById(input.heroId, manager)
        : Promise.resolve(undefined),
      input.authorId !== undefined && input.authorId !== null
        ? this.userSvc.findByIdOrFail(input.authorId, manager)
        : Promise.resolve(input.authorId === null ? null : undefined),
    ]);

    return this.saveDetached(
      article,
      {
        content: input.content,
        media: hero ? { hero: { id: hero.id } } : undefined,
        attribution:
          input.authorId === undefined
            ? undefined
            : { author: author ? { id: author.id } : null },
      },
      manager,
    );
  }

  public async updateHero(
    article: ArticleEntity,
    input: UpdateArticleHeroInput,
    manager: EntityManager = this.articleRepo.manager,
    lifecycle?: TransactionLifecycle,
  ): Promise<ArticleEntity> {
    if (!lifecycle)
      return runInTransaction(
        manager,
        (transactionManager, transactionLifecycle) =>
          this.updateHero(
            article,
            input,
            transactionManager,
            transactionLifecycle,
          ),
      );

    this.transitionPolicy.assertEditable(article.publication.status.key);

    const accessibility = resolveHeroAccessibility(
      input.altText,
      input.decorative,
    );
    // Claim the article revision before touching storage; failures roll it back.
    await this.saveDetached(article, {}, manager);
    await this.imageSvc.update(
      {
        image: article.media.hero,
        file: input.file,
        folder: input.folder,
        alt_text: accessibility.altText,
        decorative: accessibility.decorative,
      },
      manager,
      lifecycle,
    );

    return this.findByIdOrFail(article.id, manager);
  }

  public submit(
    article: ArticleEntity,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity> {
    return this.transition(
      article,
      ARTICLE_STATUS_KEYS.SUBMITTED,
      { publisher: null, publishedAt: null },
      manager,
    );
  }

  public async withdraw(
    article: ArticleEntity,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity> {
    this.transitionPolicy.assertCanWithdraw(article.publication.status.key);

    return this.applyTransition(
      article,
      ARTICLE_STATUS_KEYS.DRAFT,
      { publisher: null, publishedAt: null },
      manager,
    );
  }

  public async publish(
    article: ArticleEntity,
    publisherId: string,
    publishedAt: Date = new Date(),
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity> {
    this.transitionPolicy.assertCanTransition(
      article.publication.status.key,
      ARTICLE_STATUS_KEYS.PUBLISHED,
      { publishedAt },
    );

    resolveHeroAccessibility(
      article.media.hero?.alt_text,
      article.media.hero?.decorative,
    );
    const publisher = await this.userSvc.findByIdOrFail(publisherId, manager);

    return this.applyTransition(
      article,
      ARTICLE_STATUS_KEYS.PUBLISHED,
      { publisher: { id: publisher.id }, publishedAt },
      manager,
    );
  }

  public archive(
    article: ArticleEntity,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity> {
    return this.transition(article, ARTICLE_STATUS_KEYS.ARCHIVED, {}, manager);
  }

  public async returnToDraft(
    article: ArticleEntity,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity> {
    this.transitionPolicy.assertCanReturnToDraft(
      article.publication.status.key,
    );

    return this.applyTransition(
      article,
      ARTICLE_STATUS_KEYS.DRAFT,
      { publisher: null, publishedAt: null },
      manager,
    );
  }

  public async restore(
    article: ArticleEntity,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity> {
    this.transitionPolicy.assertCanRestore(article.publication.status.key);

    return this.applyTransition(
      article,
      ARTICLE_STATUS_KEYS.DRAFT,
      { publisher: null, publishedAt: null },
      manager,
    );
  }

  public async remove(
    article: ArticleEntity,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity> {
    await manager.delete(ArticleEntity, { id: article.id });
    return article;
  }

  private async transition(
    article: ArticleEntity,
    target: ArticleStatusKey,
    publication: DeepPartial<ArticleEntity['publication']>,
    manager: EntityManager,
  ): Promise<ArticleEntity> {
    this.transitionPolicy.assertCanTransition(
      article.publication.status.key,
      target,
    );

    return this.applyTransition(article, target, publication, manager);
  }

  private async applyTransition(
    article: ArticleEntity,
    target: ArticleStatusKey,
    publication: DeepPartial<ArticleEntity['publication']>,
    manager: EntityManager,
  ): Promise<ArticleEntity> {
    const status = await this.getStatus(target, manager);

    return this.saveDetached(
      article,
      {
        publication: {
          ...publication,
          status: { id: status.id },
        },
      },
      manager,
    );
  }

  private async saveDetached(
    article: ArticleEntity,
    input: DeepPartial<ArticleEntity>,
    manager: EntityManager,
  ): Promise<ArticleEntity> {
    // Compare and increment in a single SQL statement, including no-op edits.
    assertArticleVersion(article, article.version);
    const result = await manager.update(
      ArticleEntity,
      { id: article.id, version: article.version },
      {
        ...omitUndefinedDeep(input),
        version: () => '`version` + 1',
      } as QueryDeepPartialEntity<ArticleEntity>,
    );
    if (result.affected !== 1)
      throw new ConflictException(
        'Article has changed. Reload it before retrying.',
      );

    return this.findByIdOrFail(article.id, manager);
  }

  private async getStatus(
    key: ArticleStatusKey,
    manager: EntityManager,
  ): Promise<ArticleStatusEntity> {
    const status = await this.statusRepo.findByKey(manager, key);

    if (!status)
      throw new InternalServerErrorException(
        `Article status "${key}" is not seeded.`,
      );

    return status;
  }
}
