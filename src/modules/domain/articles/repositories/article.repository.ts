import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  FindOptionsOrder,
  SelectQueryBuilder,
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
import { articleSearchPattern } from '../policies/article-search.policy';
import type {
  ArticleImageRead,
  ArticleListPage,
  ArticleListRead,
} from '../models/article-list.read-model';

const ARTICLE_ORDER: FindOptionsOrder<ArticleEntity> = {
  createdAt: 'DESC',
  id: 'DESC',
};

type ListRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  title: string;
  summary: string;
  publishedAt: Date | null;
  status_key: string;
  status_label: string;
  author_id: string | null;
  author_first: string;
  author_last: string;
  author_preferred: string | null;
} & Record<
  `${'hero' | 'avatar'}_${'id' | 'storage_key' | 'alt_text'}`,
  string | null
> &
  Record<`${'hero' | 'avatar'}_${'width' | 'height'}`, number> &
  Record<`${'hero' | 'avatar'}_decorative`, number | boolean>;

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
  ): Promise<ArticleListPage> {
    return this.paginate(
      manager,
      pageOptions,
      { search: query.search, statusKey: ARTICLE_STATUS_KEYS.PUBLISHED },
      'publication.publishedAt',
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
  ): Promise<ArticleListPage> {
    return this.paginate(manager, pageOptions, {
      search: query.search,
      statusKey: query.statusKey,
      authorId,
    });
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
  ): Promise<ArticleListPage> {
    return this.paginate(manager, pageOptions, query);
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

  private async paginate(
    manager: EntityManager,
    pageOptions: PaginationOptions,
    scope: ArticleAdministrationQuery,
    sort: 'createdAt' | 'publication.publishedAt' = 'createdAt',
  ): Promise<ArticleListPage> {
    const query = this.listScope(manager, scope);
    const count = await query.clone().getCount();
    if (!count) return [[], 0];

    // Only to-one filtering joins; LIMIT applies directly to article rows.
    const page = await query
      .clone()
      .select('article.id', 'id')
      .orderBy(`article.${sort}`, pageOptions.order ?? Order.DESC)
      .addOrderBy('article.id', pageOptions.order ?? Order.DESC)
      .limit(pageOptions.take)
      .offset(pageOptions.skip)
      .getRawMany<{ id: string }>();
    if (!page.length) return [[], count];

    const display = this.listScope(manager, scope);
    if (!scope.statusKey)
      display.innerJoin('article.publication.status', 'status');
    display
      .innerJoin('article.media.hero', 'hero')
      .leftJoin('article.attribution.author', 'author')
      .leftJoin('author.profile', 'profile')
      .leftJoin('profile.media.avatar', 'avatar')
      .andWhere('article.id IN (:...pageIds)', {
        pageIds: page.map((row) => row.id),
      })
      .select([
        'article.id AS id',
        'article.createdAt AS createdAt',
        'article.updatedAt AS updatedAt',
        'article.version AS version',
        'article.content.title AS title',
        'article.content.summary AS summary',
        'article.publication.publishedAt AS publishedAt',
        'status.key AS status_key',
        'status.label AS status_label',
        'author.id AS author_id',
        'profile.name.first AS author_first',
        'profile.name.last AS author_last',
        'profile.name.preferred AS author_preferred',
      ]);
    for (const alias of ['hero', 'avatar']) {
      for (const column of [
        'id',
        'storage_key',
        'width',
        'height',
        'alt_text',
        'decorative',
      ]) {
        display.addSelect(`${alias}.${column}`, `${alias}_${column}`);
      }
    }
    const rows = await display.getRawMany<ListRow>();
    const byId = new Map(rows.map((row) => [row.id, this.listRead(row)]));
    // IN does not preserve ordering. Never depend on hydration query row order.
    return [
      page.flatMap((row) => {
        const article = byId.get(row.id);
        return article ? [article] : [];
      }),
      count,
    ];
  }

  private listScope(
    manager: EntityManager,
    scope: ArticleAdministrationQuery,
  ): SelectQueryBuilder<ArticleEntity> {
    // QueryBuilder deliberately bypasses eager relation graphs.
    const query = this.getRepository(manager).createQueryBuilder('article');
    if (scope.statusKey)
      query
        .innerJoin('article.publication.status', 'status')
        .andWhere('status.key = :statusKey', { statusKey: scope.statusKey });
    if (scope.authorId)
      query.andWhere('article.attribution.author = :authorId', {
        authorId: scope.authorId,
      });
    const term = articleSearchPattern(scope.search);
    if (term)
      query.andWhere(
        "(CONVERT(article.content.title USING utf8mb4) COLLATE utf8mb4_0900_ai_ci LIKE :articleSearch ESCAPE '!' OR CONVERT(article.content.summary USING utf8mb4) COLLATE utf8mb4_0900_ai_ci LIKE :articleSearch ESCAPE '!')",
        { articleSearch: term },
      );
    return query;
  }

  private listRead(row: ListRow): ArticleListRead {
    const image = (alias: 'hero' | 'avatar'): ArticleImageRead => ({
      id: row[`${alias}_id`]!,
      storage_key: row[`${alias}_storage_key`]!,
      width: row[`${alias}_width`],
      height: row[`${alias}_height`],
      alt_text: row[`${alias}_alt_text`],
      decorative: Boolean(row[`${alias}_decorative`]),
    });
    return {
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
      content: { title: row.title, summary: row.summary },
      media: { hero: image('hero') },
      attribution: {
        author: row.author_id
          ? {
              id: row.author_id,
              profile: {
                name: {
                  first: row.author_first,
                  last: row.author_last,
                  preferred: row.author_preferred,
                },
                media: { avatar: row.avatar_id ? image('avatar') : null },
              },
            }
          : null,
      },
      publication: {
        status: { key: row.status_key, label: row.status_label },
        publishedAt: row.publishedAt,
      },
    };
  }
}
