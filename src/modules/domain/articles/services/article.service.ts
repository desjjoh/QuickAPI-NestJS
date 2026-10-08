import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DeepPartial, EntityManager } from 'typeorm';

import { omitUndefinedDeep } from '@/common/helpers/typing.helper';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { ImageService } from '@/modules/domain/media/services/image.service';

import { ArticleEntity } from '../entities/article.entity';
import { ArticleStatusEntity } from '../entities/articleStatus.entity';
import { ArticleRepository } from '../repositories/article.repository';
import { ArticleStatusRepository } from '../repositories/status.repository';
import { ArticleStatusTransitionPolicy } from '../policies/article-status-transition.policy';
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

export type UpdateArticleInput = {
  content?: Partial<ArticleContentInput>;
  heroId?: string;
  authorId?: string | null;
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

  public transaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.articleRepo.manager.transaction(work);
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

  public async update(
    article: ArticleEntity,
    input: UpdateArticleInput,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity> {
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

  public returnToDraft(
    article: ArticleEntity,
    manager: EntityManager = this.articleRepo.manager,
  ): Promise<ArticleEntity> {
    return this.transition(
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
    const detached = manager.create(
      ArticleEntity,
      article as DeepPartial<ArticleEntity>,
    );
    const updated = manager.merge(
      ArticleEntity,
      detached,
      omitUndefinedDeep(input),
    );

    if (input.attribution?.author === null)
      Object.assign(updated.attribution, { author: null });
    if (input.publication?.publisher === null)
      Object.assign(updated.publication, { publisher: null });
    if (input.publication?.publishedAt === null)
      Object.assign(updated.publication, { publishedAt: null });

    await manager.save(ArticleEntity, updated);

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
