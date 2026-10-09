import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  FindOptionsOrder,
  FindOptionsWhere,
  Like,
} from 'typeorm';

import { Order, PaginationOptions } from '@/common/models/pagination.model';
import { DomainRepository } from '@/common/repositories/domain.repository';

import { ArticleEntity } from '../entities/article.entity';
import {
  ArticleAdministrationQuery,
  ArticleSearchQuery,
  CreatorArticleQuery,
} from '../models/article-query.model';
import { ARTICLE_STATUS_KEYS } from '../seeders/status.seeder';

const ARTICLE_ORDER: FindOptionsOrder<ArticleEntity> = {
  createdAt: 'DESC',
  id: 'DESC',
};

const publishedArticleOrder = (
  order: Order = Order.DESC,
): FindOptionsOrder<ArticleEntity> => ({
  publication: { publishedAt: order },
  id: order,
});

const articleOrder = (
  order: Order = Order.DESC,
): FindOptionsOrder<ArticleEntity> => ({
  createdAt: order,
  id: order,
});

@Injectable()
export class ArticleRepository extends DomainRepository<ArticleEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(ArticleEntity));
  }

  public findAll(manager: EntityManager): Promise<ArticleEntity[]> {
    return this.getRepository(manager).find({
      order: ARTICLE_ORDER,
    });
  }

  public paginatePublished(
    manager: EntityManager,
    pageOptions: PaginationOptions,
    query: ArticleSearchQuery = {},
  ): Promise<[ArticleEntity[], number]> {
    const scope: FindOptionsWhere<ArticleEntity> = {
      publication: { status: { key: ARTICLE_STATUS_KEYS.PUBLISHED } },
    };

    return this.paginate(
      manager,
      pageOptions,
      scope,
      query.search,
      publishedArticleOrder(pageOptions.order),
    );
  }

  public findPublishedById(
    manager: EntityManager,
    id: string,
  ): Promise<ArticleEntity | null> {
    return this.getRepository(manager).findOne({
      where: {
        id,
        publication: { status: { key: ARTICLE_STATUS_KEYS.PUBLISHED } },
      },
    });
  }

  public paginateByAuthor(
    manager: EntityManager,
    authorId: string,
    pageOptions: PaginationOptions,
    query: CreatorArticleQuery = {},
  ): Promise<[ArticleEntity[], number]> {
    const scope: FindOptionsWhere<ArticleEntity> = {
      attribution: { author: { id: authorId } },
      ...(query.statusKey
        ? { publication: { status: { key: query.statusKey } } }
        : {}),
    };

    return this.paginate(
      manager,
      pageOptions,
      scope,
      query.search,
      articleOrder(pageOptions.order),
    );
  }

  public findByIdAndAuthor(
    manager: EntityManager,
    id: string,
    authorId: string,
  ): Promise<ArticleEntity | null> {
    return this.getRepository(manager).findOne({
      where: {
        id,
        attribution: { author: { id: authorId } },
      },
    });
  }

  public findByIdAndAuthorForUpdate(
    manager: EntityManager,
    id: string,
    authorId: string,
  ): Promise<ArticleEntity | null> {
    return this.getRepository(manager).findOne({
      where: {
        id,
        attribution: { author: { id: authorId } },
      },
      lock: { mode: 'pessimistic_write' },
    });
  }

  public findByIdForUpdate(
    manager: EntityManager,
    id: string,
  ): Promise<ArticleEntity | null> {
    return this.getRepository(manager).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  public paginateForAdministration(
    manager: EntityManager,
    pageOptions: PaginationOptions,
    query: ArticleAdministrationQuery = {},
  ): Promise<[ArticleEntity[], number]> {
    const scope: FindOptionsWhere<ArticleEntity> = {
      ...(query.authorId
        ? { attribution: { author: { id: query.authorId } } }
        : {}),
      ...(query.statusKey
        ? { publication: { status: { key: query.statusKey } } }
        : {}),
    };

    return this.paginate(
      manager,
      pageOptions,
      scope,
      query.search,
      articleOrder(pageOptions.order),
    );
  }

  public findByStatusKey(
    manager: EntityManager,
    statusKey: string,
  ): Promise<ArticleEntity[]> {
    return this.getRepository(manager).find({
      where: { publication: { status: { key: statusKey } } },
      order: ARTICLE_ORDER,
    });
  }

  public findByAuthorId(
    manager: EntityManager,
    authorId: string,
  ): Promise<ArticleEntity[]> {
    return this.getRepository(manager).find({
      where: { attribution: { author: { id: authorId } } },
      order: ARTICLE_ORDER,
    });
  }

  private paginate(
    manager: EntityManager,
    pageOptions: PaginationOptions,
    scope: FindOptionsWhere<ArticleEntity>,
    search?: string,
    order: FindOptionsOrder<ArticleEntity> = ARTICLE_ORDER,
  ): Promise<[ArticleEntity[], number]> {
    return this.getRepository(manager).findAndCount({
      where: this.withSearch(scope, search),
      order,
      take: pageOptions.take,
      skip: pageOptions.skip,
    });
  }

  private withSearch(
    scope: FindOptionsWhere<ArticleEntity>,
    search?: string,
  ): FindOptionsWhere<ArticleEntity> | FindOptionsWhere<ArticleEntity>[] {
    const term = search?.trim();

    if (!term) return scope;

    const pattern = Like(`%${term}%`);

    return [
      { ...scope, content: { title: pattern } },
      { ...scope, content: { summary: pattern } },
    ];
  }
}
