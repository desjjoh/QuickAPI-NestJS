import type { INestApplication } from '@nestjs/common';
import { getOptionsToken } from '@nestjs/throttler';
import { mkdir, rm, readdir } from 'node:fs/promises';
import request from 'supertest';
import { jest } from '@jest/globals';
import {
  SelectQueryBuilder,
  type Logger,
  type FindOptionsWhere,
} from 'typeorm';
import { Order, PaginationOptions } from '@/common/models/pagination.model';
import { ArticleRepository } from '@/modules/domain/articles/repositories/article.repository';
import { ArticleStatusEntity } from '@/modules/domain/articles/entities/articleStatus.entity';
import { ArticleService } from '@/modules/domain/articles/services/article.service';
import type {
  ArticleListPage,
  ArticleListRead,
} from '@/modules/domain/articles/models/article-list.read-model';
import { ArticleListItemDto } from '@/modules/domain/articles/models/article.model';
import { ArticleManagementListItemDto } from '@/modules/domain/articles/models/article-management.model';

import { env } from '@/config/environment.config';
import { ArticleAuditEvents } from '@/config/audit-events.config';
import { ArticleEntity } from '@/modules/domain/articles/entities/article.entity';
import { AuditEventEntity } from '@/modules/domain/audit/entities/audit-event.entity';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserProfileEntity } from '@/modules/domain/identity/entities/profile.entity';
import { ImageEntity } from '@/modules/domain/media/entities/image.entity';
import { StorageObjectEntity } from '@/modules/system/storage/entities/storage-object.entity';
import { AccountTokenType } from '@/config/token.config';
import { AccountTokenEntity } from '@/modules/domain/identity/entities/account-token.entity';
import { UserMfaSettingsEntity } from '@/modules/domain/identity/entities/mfa.entity';
import { UserPhoneEntity } from '@/modules/domain/identity/entities/phone.entity';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { RegistrationTokenEntity } from '@/modules/domain/identity/entities/registration-token.entity';
import { EmailIntentEntity } from '@/modules/system/email/entities/email-intent.entity';
import { sealEmail } from '@/modules/system/email/services/email-outbox.service';
import { IdempotencyEntity } from '@/modules/system/idempotency/entities/idempotency.entity';
import { drainStorageCleanup } from '../../helpers/storage-cleanup';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';
import { ROLE_KEYS } from '@/modules/domain/library/seeders/role.seeder';
import { EmailService } from '@/modules/system/email/services/email.service';
import {
  DeleteStorageObjectInput,
  PutStorageObjectInput,
  StorageService,
} from '@/modules/system/storage/types/storage.types';

import {
  acquireCsrf,
  CapturingEmailService,
  registrationPayload,
  REGISTRATION_ROOT,
} from '../authentication/authentication-e2e.helpers';
import {
  setupTestSuite,
  teardownTestSuite,
  TestSuite,
} from '../../helpers/test-app';

const PUBLIC_ROOT = '/api/v1/articles/public';
const CREATOR_ROOT = '/api/v1/articles/me';
const ADMINISTRATION_ROOT = '/api/v1/administration/articles';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

class MemoryStorage extends StorageService {
  public readonly objects = new Map<string, Buffer>();

  public async putObject(input: PutStorageObjectInput) {
    this.objects.set(input.key, Buffer.from(input.body));
    return {
      key: input.key,
      url: `memory://${input.key}`,
      contentType: input.contentType,
      sizeBytes: Buffer.byteLength(input.body),
    };
  }

  public async deleteObject({ key }: DeleteStorageObjectInput): Promise<void> {
    this.objects.delete(key);
  }

  public async objectExists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }
}

type AuthenticatedAgent = {
  agent: ReturnType<typeof request.agent>;
  headers: { authorization: string; 'x-csrf-token': string };
};

describe('article API lifecycle', () => {
  it('EXPLAINs actual article pagination SQL on representative data', async () => {
    const author = await register('index-author@example.test');
    const other = await register('index-other@example.test');
    const statuses = await suite.dataSource
      .getRepository(ArticleStatusEntity)
      .find();
    const statusId = (key: string) =>
      statuses.find((status) => status.key === key)!.id;
    const images = suite.dataSource.getRepository(ImageEntity);
    const hero = await images.save(
      images.create({
        storage_key: 'index-fixture.png',
        filename: 'index-fixture.png',
        mime_type: 'image/png',
        size_bytes: 1,
        width: 1,
        height: 1,
        decorative: true,
      }),
    );
    const articles = suite.dataSource.getRepository(ArticleEntity);
    // 16k rows, skewed statuses, a selective author, and tied dates/ID ordering.
    for (let start = 0; start < 16_000; start += 500) {
      await articles.insert(
        Array.from({ length: 500 }, (_, offset) => {
          const i = start + offset;
          const key =
            i % 10 < 3
              ? 'published'
              : i % 10 === 3
                ? 'submitted'
                : i % 10 === 9
                  ? 'archived'
                  : 'draft';
          const date = new Date(Date.UTC(2026, 0, 1) + (i % 2000) * 60_000);
          return {
            id: `qidx-${String(i).padStart(11, '0')}`,
            createdAt: date,
            content: {
              title: `Article ${i}`,
              summary: 'Representative query data',
              body: 'Fixture',
            },
            media: { hero: { id: hero.id } },
            attribution: {
              author: { id: i % 31 === 0 ? author.id : other.id },
            },
            publication: {
              status: { id: statusId(key) },
              publishedAt: key === 'published' ? date : null,
            },
          };
        }),
      );
    }
    await suite.dataSource.query('ANALYZE TABLE `articles`');
    const repository = new ArticleRepository(suite.dataSource);
    const originalLogger = suite.dataSource.logger;
    const statements: Array<{ sql: string; parameters: unknown[] }> = [];
    const capture: Logger = {
      logQuery: (sql, parameters) => {
        statements.push({ sql, parameters: parameters ?? [] });
      },
      logQueryError() {},
      logQuerySlow() {},
      logSchemaBuild() {},
      logMigration() {},
      log() {},
    };
    const planNodes = (value: unknown): Record<string, unknown>[] => {
      if (!value || typeof value !== 'object') return [];
      if (Array.isArray(value)) return value.flatMap(planNodes);
      const node = value as Record<string, unknown>;
      return [node, ...Object.values(node).flatMap(planNodes)];
    };
    const cases = [
      {
        name: 'public',
        index: 'IDX_articles_public_listing',
        run: (page: PaginationOptions) =>
          repository.paginatePublished(suite.dataSource.manager, page),
      },
      {
        name: 'creator',
        index: 'IDX_articles_creator_listing',
        run: (page: PaginationOptions) =>
          repository.paginateByAuthor(
            suite.dataSource.manager,
            author.id,
            page,
          ),
      },
      {
        name: 'review',
        index: 'IDX_articles_review_listing',
        run: (page: PaginationOptions) =>
          repository.paginateForAdministration(suite.dataSource.manager, page, {
            statusKey: 'submitted',
          }),
      },
      {
        name: 'creator-status',
        index: null,
        run: (page: PaginationOptions) =>
          repository.paginateByAuthor(
            suite.dataSource.manager,
            author.id,
            page,
            { statusKey: 'published' },
          ),
      },
      {
        name: 'administration-unfiltered',
        index: null,
        run: (page: PaginationOptions) =>
          repository.paginateForAdministration(suite.dataSource.manager, page),
      },
    ];
    try {
      suite.dataSource.logger = capture;
      await articles.findAndCount({
        where: { publication: { status: { key: 'published' } } },
        order: { publication: { publishedAt: 'ASC' }, id: 'ASC' },
        take: 25,
      });
      suite.dataSource.logger = originalLogger;
      const baselineSql = statements.find((statement) =>
        statement.sql.startsWith('SELECT DISTINCT'),
      );
      expect(baselineSql).toBeDefined();
      const baselinePlan = JSON.parse(
        (
          await suite.dataSource.query(
            `EXPLAIN FORMAT=JSON ${baselineSql!.sql}`,
            baselineSql!.parameters,
          )
        )[0].EXPLAIN,
      ) as unknown;
      const baselineTables = planNodes(baselinePlan).filter(
        (node) => typeof node.table_name === 'string',
      ).length;
      for (const order of [Order.ASC, Order.DESC]) {
        for (const scenario of cases) {
          statements.length = 0;
          suite.dataSource.logger = capture;
          const [rows] = await scenario.run(
            Object.assign(new PaginationOptions(), { order }),
          );
          suite.dataSource.logger = originalLogger;
          expect(rows).toHaveLength(25);
          // The actual count, ID page, and display queries must remain bounded.
          expect(statements).toHaveLength(3);
          const [countSql, sql, displaySql] = statements;
          expect(countSql.sql).toMatch(/COUNT\(/);
          expect(sql.sql).toMatch(/LIMIT 25/);
          expect(sql.sql).not.toMatch(
            /DISTINCT|user_profiles|user_roles|permissions|images/,
          );
          expect(countSql.sql).not.toMatch(
            /user_profiles|user_roles|permissions|images/,
          );
          expect(displaySql.sql).not.toMatch(
            /user_roles|permissions|publisher|password|email|`body`/,
          );
          expect(displaySql.sql).toMatch(/ IN \(/);
          const explain = await suite.dataSource.query(
            `EXPLAIN FORMAT=JSON ${sql.sql}`,
            sql.parameters,
          );
          const plan = JSON.parse(explain[0].EXPLAIN) as unknown;
          const nodes = planNodes(plan);
          const access = nodes.filter((node) => node.table_name === 'article');
          expect(
            nodes.filter((node) => typeof node.table_name === 'string').length,
          ).toBeLessThanOrEqual(2);
          expect(
            nodes.filter((node) => typeof node.table_name === 'string').length,
          ).toBeLessThan(baselineTables);
          const displayPlan = JSON.parse(
            (
              await suite.dataSource.query(
                `EXPLAIN FORMAT=JSON ${displaySql.sql}`,
                displaySql.parameters,
              )
            )[0].EXPLAIN,
          ) as unknown;
          expect(
            planNodes(displayPlan).some(
              (node) => node.table_name === 'article' && node.key === 'PRIMARY',
            ),
          ).toBe(true);
          if (scenario.index) {
            // Statistics can make MySQL choose another index with the same filter prefix.
            // Check eligibility and indexed filtering, not a particular optimizer decision.
            const filterColumn =
              scenario.name === 'creator' ? 'author_id' : 'status_id';
            expect(
              access.some(
                (table) =>
                  Array.isArray(table.possible_keys) &&
                  table.possible_keys.includes(scenario.index),
              ),
            ).toBe(true);
            expect(
              access.some(
                (table) =>
                  typeof table.key === 'string' &&
                  Array.isArray(table.used_key_parts) &&
                  table.used_key_parts[0] === filterColumn,
              ),
            ).toBe(true);
          }
        }
      }
    } finally {
      suite.dataSource.logger = originalLogger;
    }
  }, 60_000);
  let suite: TestSuite;
  let app: INestApplication;
  let email: CapturingEmailService;
  let storage: MemoryStorage;

  beforeAll(async () => {
    email = new CapturingEmailService();
    storage = new MemoryStorage();
    suite = await setupTestSuite((builder) =>
      builder
        .overrideProvider(EmailService)
        .useValue(email)
        .overrideProvider(StorageService)
        .useValue(storage)
        .overrideProvider(getOptionsToken())
        .useValue({
          skipIf: () => true,
          throttlers: [{ name: 'default', limit: 1, ttl: 60_000 }],
        }),
    );
    app = suite.app;
  });

  beforeEach(async () => {
    await mkdir(env.UPLOAD_TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    storage.objects.clear();
    email.clear();
    await rm(env.UPLOAD_TMP_DIR, { recursive: true, force: true });
    await suite.resetDatabase();
  });

  afterAll(async () => {
    await rm(env.UPLOAD_TMP_DIR, { recursive: true, force: true });
    await teardownTestSuite(suite);
  });

  async function register(address: string): Promise<UserEntity> {
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const pending = await agent
      .post(`${REGISTRATION_ROOT}/request`)
      .set('x-csrf-token', csrf)
      .send({
        ...(await registrationPayload(suite.dataSource)),
        email: address,
      })
      .expect(201);
    const challenge = pending.body.challenge_id as string;

    await agent
      .post(`${REGISTRATION_ROOT}/confirm`)
      .set('x-csrf-token', csrf)
      .send({
        challenge_id: challenge,
        code: email.verificationCodeFor(challenge),
      })
      .expect(200);

    return suite.dataSource.getRepository(UserEntity).findOneOrFail({
      where: { identity: { email: address } },
    });
  }

  it('enforces literal search semantics and independent visibility filters', async () => {
    const author = await register('search-author@example.test');
    const other = await register('search-other@example.test');
    const statuses = await suite.dataSource
      .getRepository(ArticleStatusEntity)
      .find();
    const images = suite.dataSource.getRepository(ImageEntity);
    const hero = await images.save(
      images.create({
        storage_key: 'search-fixture.png',
        filename: 'search-fixture.png',
        mime_type: 'image/png',
        size_bytes: 1,
        width: 1,
        height: 1,
        decorative: true,
      }),
    );
    const articles = suite.dataSource.getRepository(ArticleEntity);
    const publishedIds: string[] = [];
    const add = async (
      title: string,
      summary = 'Neutral summary',
      body = 'Neutral body',
      status = 'published',
      authorId: string | null = author.id,
    ) => {
      const article = await articles.save(
        articles.create({
          content: { title, summary, body },
          media: { hero: { id: hero.id } },
          attribution: { author: authorId ? { id: authorId } : null },
          publication: {
            status: {
              id: statuses.find((candidate) => candidate.key === status)!.id,
            },
            publishedAt: status === 'published' ? new Date() : null,
          },
        }),
      );
      if (status === 'published') publishedIds.push(article.id);
      return article.id;
    };
    const literal = await add("100% under_score! C:\\articles ' OR 1=1");
    await add('1000 underXscore C:articles');
    const accented = await add('Café handbook');
    const phrase = await add('Alpha beta guide');
    await add('Body-only fixture', 'Neutral summary', 'bodyexclusive');
    await add(
      'Unassigned byline',
      'Neutral summary',
      'Neutral body',
      'published',
      null,
    );
    // One byline has an avatar; the other does not. Both must match the old DTO.
    await suite.dataSource
      .getRepository(UserProfileEntity)
      .update(author.profile.id, { media: { avatar: { id: hero.id } } });
    const scopeIds: Record<string, string[]> = {};
    for (const owner of [author, other]) {
      for (const status of ['published', 'submitted', 'archived']) {
        const ids = [] as string[];
        for (const field of ['title', 'summary']) {
          ids.push(
            await add(
              field === 'title' ? 'Scope needle' : 'Neutral title',
              field === 'summary' ? 'Scope needle' : 'Neutral summary',
              'Neutral body',
              status,
              owner.id,
            ),
          );
        }
        scopeIds[`${owner.id}:${status}`] = ids;
      }
    }
    await add('Scope needle', 'Scope needle', 'Neutral body', 'draft');

    // HTTP coverage also exercises URL encoding and the query DTO validation.
    for (const [search, ids] of [
      ['%', [literal]],
      ['_', [literal]],
      ['!', [literal]],
      ['C:\\articles', [literal]],
      ["' OR 1=1", [literal]],
      ['CAFE', [accented]],
      ['CAFE\u0301', [accented]],
      [' \tALPHA\u00a0  beta\n ', [phrase]],
      ['bodyexclusive', []],
    ] as Array<[string, string[]]>) {
      const response = await request(app.getHttpServer())
        .get(PUBLIC_ROOT)
        .query({ search })
        .expect(200);
      expect(
        response.body.data.map((article: { id: string }) => article.id).sort(),
      ).toEqual([...ids].sort());
      expect(response.body.meta.itemCount).toBe(ids.length);
    }
    const absent = await request(app.getHttpServer())
      .get(PUBLIC_ROOT)
      .expect(200);
    const blank = await request(app.getHttpServer())
      .get(PUBLIC_ROOT)
      .query({ search: ' \t\n ' })
      .expect(200);
    expect(blank.body).toEqual(absent.body);
    expect(blank.body.meta.itemCount).toBe(publishedIds.length);
    await request(app.getHttpServer())
      .get(PUBLIC_ROOT)
      .query({ search: ' '.repeat(256) })
      .expect(422);

    const repository = new ArticleRepository(suite.dataSource);
    const page = new PaginationOptions();
    const publicResults = await repository.paginatePublished(
      suite.dataSource.manager,
      page,
      { search: 'scope needle' },
    );
    const creatorResults = await repository.paginateByAuthor(
      suite.dataSource.manager,
      author.id,
      page,
      { search: 'scope needle', statusKey: 'submitted' },
    );
    const administrationResults = await repository.paginateForAdministration(
      suite.dataSource.manager,
      page,
      { search: 'scope needle', authorId: author.id, statusKey: 'submitted' },
    );
    const expectedPublic = [
      ...scopeIds[`${author.id}:published`],
      ...scopeIds[`${other.id}:published`],
    ];
    for (const [result, ids] of [
      [publicResults, expectedPublic],
      [creatorResults, scopeIds[`${author.id}:submitted`]],
      [administrationResults, scopeIds[`${author.id}:submitted`]],
    ] as Array<[ArticleListPage, string[]]>) {
      expect(result[0].map((article) => article.id).sort()).toEqual(
        [...ids].sort(),
      );
      expect(result[1]).toBe(ids.length);
    }

    const scenarios: Array<{
      public: boolean;
      scope: FindOptionsWhere<ArticleEntity>;
      run: (page: PaginationOptions) => Promise<ArticleListPage>;
    }> = [
      {
        public: true,
        scope: { publication: { status: { key: 'published' } } },
        run: (page) =>
          repository.paginatePublished(suite.dataSource.manager, page),
      },
      {
        public: false,
        scope: { attribution: { author: { id: author.id } } },
        run: (page) =>
          repository.paginateByAuthor(
            suite.dataSource.manager,
            author.id,
            page,
          ),
      },
      {
        public: false,
        scope: {
          publication: { status: { key: 'submitted' } },
          attribution: { author: { id: author.id } },
        },
        run: (page) =>
          repository.paginateForAdministration(suite.dataSource.manager, page, {
            statusKey: 'submitted',
            authorId: author.id,
          }),
      },
    ];
    // Compare the unchanged API projection to the former eager pagination path.
    for (const scenario of scenarios) {
      for (const order of [Order.ASC, Order.DESC]) {
        for (const pageNumber of [1, 2, 50]) {
          const page = Object.assign(new PaginationOptions(), {
            order,
            take: 2,
            page: pageNumber,
          });
          const [expected, total] = await articles.findAndCount({
            where: scenario.scope,
            take: page.take,
            skip: page.skip,
            order: scenario.public
              ? { publication: { publishedAt: order }, id: order }
              : { createdAt: order, id: order },
          });
          const [actual, count] = await scenario.run(page);
          const project = (row: ArticleListRead) =>
            scenario.public
              ? new ArticleListItemDto(row)
              : new ArticleManagementListItemDto(row);
          expect(actual.map(project)).toEqual(expected.map(project));
          expect(count).toBe(total);
          for (const row of actual) {
            expect(row.content).not.toHaveProperty('body');
            expect(row.publication).not.toHaveProperty('publisher');
            if (row.attribution.author) {
              expect(row.attribution.author).not.toHaveProperty('identity');
              expect(row.attribution.author).not.toHaveProperty('roles');
            }
          }
        }
      }
    }

    // Change status on another connection after COUNT has established the snapshot.
    const originalCount = SelectQueryBuilder.prototype.getCount;
    const countSpy = jest
      .spyOn(SelectQueryBuilder.prototype, 'getCount')
      .mockImplementationOnce(async function (
        this: SelectQueryBuilder<ArticleEntity>,
      ) {
        const count = await originalCount.call(this);
        await articles.update(literal, {
          content: { title: 'Changed title' },
          publication: {
            status: {
              id: statuses.find((status) => status.key === 'archived')!.id,
            },
          },
        });
        return count;
      });
    try {
      const [snapshot, count] = await app
        .get(ArticleService)
        .paginatePublished(new PaginationOptions(), { search: '%' });
      expect(count).toBe(1);
      expect(snapshot.map((row) => row.id)).toEqual([literal]);
      expect(snapshot[0].content.title).toContain('100%');
    } finally {
      countSpy.mockRestore();
    }
    expect(
      await app
        .get(ArticleService)
        .paginatePublished(new PaginationOptions(), { search: '%' }),
    ).toEqual([[], 0]);
  }, 30_000);

  async function assignRole(user: UserEntity, key: ROLE_KEYS): Promise<void> {
    const role = await suite.dataSource
      .getRepository(RoleEntity)
      .findOneByOrFail({ key });

    await suite.dataSource
      .createQueryBuilder()
      .relation(UserEntity, 'roles')
      .of(user.id)
      .add(role.id);
  }

  async function signIn(address: string): Promise<AuthenticatedAgent> {
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const response = await agent
      .post('/api/v1/authentication/sign-in')
      .set('x-csrf-token', csrf)
      .send({ email: address, password: 'Valid!Pass1' })
      .expect(201);

    return {
      agent,
      headers: {
        authorization: `Bearer ${response.body.access_token as string}`,
        'x-csrf-token': csrf,
      },
    };
  }

  async function creator(address = 'creator@example.test') {
    const user = await register(address);
    await assignRole(user, ROLE_KEYS.CREATOR);
    return { user, ...(await signIn(address)) };
  }

  async function administrator(address = 'administrator@example.test') {
    const user = await register(address);
    await assignRole(user, ROLE_KEYS.ADMINISTRATOR);
    return { user, ...(await signIn(address)) };
  }

  async function currentVersion(id: string): Promise<number> {
    return (
      await suite.dataSource
        .getRepository(ArticleEntity)
        .findOneByOrFail({ id })
    ).version;
  }

  async function createDraft(auth: AuthenticatedAgent, key?: string) {
    return auth.agent
      .post(CREATOR_ROOT)
      .set({ ...auth.headers, ...(key ? { 'Idempotency-Key': key } : {}) })
      .field('title', 'Maintainable NestJS Articles')
      .field('summary', 'A complete article API lifecycle test.')
      .field('body', 'Confidential draft body that must not enter audit logs.')
      .field('hero_alt_text', 'A small test image.')
      .attach('hero', PNG, {
        filename: 'hero.png',
        contentType: 'image/png',
      })
      .expect(201);
  }

  it('keeps public reads open while enforcing authentication and creator permissions', async () => {
    const ordinary = await register('ordinary@example.test');
    const auth = await signIn(ordinary.identity.email);

    await request(app.getHttpServer()).get(PUBLIC_ROOT).expect(200);
    await request(app.getHttpServer()).get(CREATOR_ROOT).expect(401);
    for (const retired of [
      '/api/v1/public/articles',
      '/api/v1/account/articles',
    ])
      await auth.agent.get(retired).set(auth.headers).expect(404);
    await request(app.getHttpServer()).get(`${PUBLIC_ROOT}/me`).expect(422);
    await auth.agent.get(CREATOR_ROOT).set(auth.headers).expect(403);
    await request(app.getHttpServer()).get(ADMINISTRATION_ROOT).expect(401);
    await auth.agent.get(ADMINISTRATION_ROOT).set(auth.headers).expect(403);
  });

  it('isolates account article routing from public article ID matching and retires the old paths', async () => {
    const author = await creator();
    const response = await author.agent
      .get(CREATOR_ROOT)
      .set(author.headers)
      .expect(200);
    expect(response.body.data).toEqual([]);
    await request(app.getHttpServer()).get(CREATOR_ROOT).expect(401);
    await author.agent
      .get('/api/v1/creator/articles')
      .set(author.headers)
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/articles/creator')
      .expect(404);
    await request(app.getHttpServer()).get('/api/v1/articles').expect(404);
  });

  it('allows only one concurrent edit from the same version and rejects stale image and lifecycle requests', async () => {
    const author = await creator();
    const admin = await administrator();
    const created = await createDraft(author);
    const articleId = created.body.id as string;
    const version = created.body.version as number;
    expect(version).toBe(1);
    const beforeEvents = await suite.dataSource
      .getRepository(AuditEventEntity)
      .count();
    const edits = await Promise.all(
      ['First edit', 'Second edit'].map((title) =>
        author.agent
          .patch(`${CREATOR_ROOT}/${articleId}`)
          .set(author.headers)
          .send({ title, expected_version: version }),
      ),
    );
    expect(edits.map((response) => response.status).sort()).toEqual([200, 409]);
    const winner = edits.find((response) => response.status === 200)!;
    expect(winner.body.version).toBe(version + 1);
    const persisted = await suite.dataSource
      .getRepository(ArticleEntity)
      .findOneByOrFail({ id: articleId });
    expect(persisted.version).toBe(version + 1);
    expect(persisted.content.title).toBe(winner.body.title);
    expect(await suite.dataSource.getRepository(AuditEventEntity).count()).toBe(
      beforeEvents + 1,
    );
    const keys = [...storage.objects.keys()];

    await author.agent
      .put(`${CREATOR_ROOT}/${articleId}/hero`)
      .set(author.headers)
      .field('expected_version', String(version))
      .field('hero_alt_text', 'Stale replacement')
      .attach('hero', PNG, 'stale.png')
      .expect(409);
    await author.agent
      .post(`${CREATOR_ROOT}/${articleId}/submit`)
      .set(author.headers)
      .send({ expected_version: version })
      .expect(409);
    expect([...storage.objects.keys()]).toEqual(keys);
    expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);
    expect(await suite.dataSource.getRepository(AuditEventEntity).count()).toBe(
      beforeEvents + 1,
    );
    await author.agent
      .patch(`${CREATOR_ROOT}/${articleId}`)
      .set(author.headers)
      .send({ title: 'Missing version' })
      .expect(422);

    const submitted = await author.agent
      .post(`${CREATOR_ROOT}/${articleId}/submit`)
      .set(author.headers)
      .send({ expected_version: winner.body.version })
      .expect(200);
    expect(submitted.body.version).toBe(version + 2);
    await admin.agent
      .post(`${ADMINISTRATION_ROOT}/${articleId}/publish`)
      .set(admin.headers)
      .send({ expected_version: winner.body.version })
      .expect(409);
    const published = await admin.agent
      .post(`${ADMINISTRATION_ROOT}/${articleId}/publish`)
      .set(admin.headers)
      .send({ expected_version: submitted.body.version })
      .expect(200);
    expect(published.body.version).toBe(version + 3);
    const publicArticle = await request(app.getHttpServer())
      .get(`${PUBLIC_ROOT}/${articleId}`)
      .expect(200);
    expect(publicArticle.body).not.toHaveProperty('version');
  });

  it('replays creation, hero replacement, and administration actions without repeating storage or audit mutations', async () => {
    const author = await creator();
    const admin = await administrator();
    const first = await createDraft(author, 'create-request');
    const articleId = first.body.id as string;
    const eventCount = await suite.dataSource
      .getRepository(AuditEventEntity)
      .count();
    expect((await createDraft(author, 'create-request')).body).toEqual(
      first.body,
    );
    expect(await suite.dataSource.getRepository(ArticleEntity).count()).toBe(1);
    expect(await suite.dataSource.getRepository(ImageEntity).count()).toBe(1);
    expect(storage.objects.size).toBe(1);
    expect(await suite.dataSource.getRepository(AuditEventEntity).count()).toBe(
      eventCount,
    );

    const replace = () =>
      author.agent
        .put(`${CREATOR_ROOT}/${articleId}/hero`)
        .set(author.headers)
        .set('Idempotency-Key', 'replace-request')
        .field('expected_version', String(first.body.version))
        .field('hero_alt_text', 'Replacement image')
        .attach('hero', PNG, 'replacement.png');
    const replaced = await replace().expect(200);
    const replacementKeys = [...storage.objects.keys()];
    expect((await replace().expect(200)).body).toEqual(replaced.body);
    expect([...storage.objects.keys()]).toEqual(replacementKeys);
    expect(await suite.dataSource.getRepository(AuditEventEntity).count()).toBe(
      eventCount + 1,
    );

    const submitted = await author.agent
      .post(`${CREATOR_ROOT}/${articleId}/submit`)
      .set(author.headers)
      .send({ expected_version: replaced.body.version })
      .expect(200);
    let version = submitted.body.version as number;
    for (const action of ['publish', 'archive', 'restore']) {
      const payload = {
        expected_version: version,
        ...(action !== 'publish' ? { reason_code: 'data_correction' } : {}),
      };
      const act = () =>
        admin.agent
          .post(`${ADMINISTRATION_ROOT}/${articleId}/${action}`)
          .set(admin.headers)
          .set('Idempotency-Key', `${action}-request`)
          .send(payload);
      const result = await act().expect(200);
      expect((await act().expect(200)).body).toEqual(result.body);
      version = result.body.version as number;
    }
    expect(await currentVersion(articleId)).toBe(version);
    expect(await suite.dataSource.getRepository(AuditEventEntity).count()).toBe(
      eventCount + 5,
    );
    // Creation replay is still the original response, not today's revised resource.
    expect((await createDraft(author, 'create-request')).body).toEqual(
      first.body,
    );
    await author.agent
      .post(CREATOR_ROOT)
      .set(author.headers)
      .set('Idempotency-Key', 'create-request')
      .field('title', 'Different title')
      .field('summary', 'Summary')
      .field('body', 'Body')
      .field('hero_alt_text', 'A small test image.')
      .attach('hero', PNG, 'hero.png')
      .expect(409);
    expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);
  });

  it('serializes concurrent creation keys across database connections', async () => {
    const author = await creator();
    const audits = suite.dataSource.getRepository(AuditEventEntity);
    // Registration and sign-in already produced legitimate audit events.
    const eventsBeforeCreation = await audits.count();
    const create = () =>
      author.agent
        .post(CREATOR_ROOT)
        .set(author.headers)
        .set('Idempotency-Key', 'concurrent-create')
        .field('title', 'Concurrent creation')
        .field('summary', 'Summary')
        .field('body', 'Body')
        .field('hero_alt_text', 'A test image')
        .attach('hero', PNG, 'hero.png');
    const responses = await Promise.all([create(), create()]);
    expect(responses.some((response) => response.status === 201)).toBe(true);
    expect(
      responses.every((response) => [201, 409].includes(response.status)),
    ).toBe(true);
    const original = responses.find((response) => response.status === 201)!;
    expect((await create().expect(201)).body).toEqual(original.body);
    expect(await suite.dataSource.getRepository(ArticleEntity).count()).toBe(1);
    expect(await suite.dataSource.getRepository(ImageEntity).count()).toBe(1);
    expect(storage.objects.size).toBe(1);
    expect(await audits.count()).toBe(eventsBeforeCreation + 1);
    expect(
      await audits.count({
        where: {
          event: ArticleAuditEvents.CREATED,
          resource_id: original.body.id as string,
        },
      }),
    ).toBe(1);
  });

  it('validates the multipart article creation contract', async () => {
    const auth = await creator();

    await auth.agent
      .post(CREATOR_ROOT)
      .set(auth.headers)
      .field('title', 'Missing hero')
      .field('summary', 'Summary')
      .field('body', 'Body')
      .field('hero_alt_text', 'Missing image description')
      .expect(400);

    await auth.agent
      .post(CREATOR_ROOT)
      .set(auth.headers)
      .field('title', 'Unsupported hero')
      .field('summary', 'Summary')
      .field('body', 'Body')
      .field('hero_alt_text', 'Unsupported image description')
      .attach('hero', Buffer.from('not an image'), {
        filename: 'hero.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    expect(storage.objects.size).toBe(0);
    expect(await suite.dataSource.getRepository(ArticleEntity).count()).toBe(0);
    expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);
  });

  it('persists and publishes explicit decorative heroes and clears stale replacement text', async () => {
    const author = await creator();
    const admin = await administrator();
    const created = await author.agent
      .post(CREATOR_ROOT)
      .set(author.headers)
      .field('title', 'Decorative hero')
      .field('summary', 'Summary')
      .field('body', 'Body')
      .field('hero_decorative', 'true')
      .attach('hero', PNG, 'hero.png')
      .expect(201);
    expect(created.body.hero).toMatchObject({
      altText: null,
      decorative: true,
    });
    const articleId = created.body.id as string;

    await author.agent
      .put(`${CREATOR_ROOT}/${articleId}/hero`)
      .set(author.headers)
      .field('expected_version', String(await currentVersion(articleId)))
      .field('hero_alt_text', 'A new informative image')
      .attach('hero', PNG, 'hero.png')
      .expect(200);
    const replaced = await author.agent
      .put(`${CREATOR_ROOT}/${articleId}/hero`)
      .set(author.headers)
      .field('expected_version', String(await currentVersion(articleId)))
      .field('hero_decorative', 'true')
      .attach('hero', PNG, 'hero.png')
      .expect(200);
    expect(replaced.body.hero).toMatchObject({
      altText: null,
      decorative: true,
    });
    await author.agent
      .post(`${CREATOR_ROOT}/${articleId}/submit`)
      .set(author.headers)
      .send({ expected_version: await currentVersion(articleId) })
      .expect(200);
    await admin.agent
      .post(`${ADMINISTRATION_ROOT}/${articleId}/publish`)
      .set(admin.headers)
      .send({ expected_version: await currentVersion(articleId) })
      .expect(200);
    const published = await request(app.getHttpServer())
      .get(`${PUBLIC_ROOT}/${articleId}`)
      .expect(200);
    expect(published.body.hero).toMatchObject({
      altText: null,
      decorative: true,
    });
  });

  it('preserves published articles and historical attribution when author and publisher delete their accounts', async () => {
    const author = await creator();
    const admin = await administrator();
    const created = await createDraft(author);
    const id = created.body.id as string;
    await author.agent
      .post(`${CREATOR_ROOT}/${id}/submit`)
      .set(author.headers)
      .send({ expected_version: created.body.version })
      .expect(200);
    await admin.agent
      .post(`${ADMINISTRATION_ROOT}/${id}/publish`)
      .set(admin.headers)
      .send({ expected_version: await currentVersion(id) })
      .expect(200);
    const before = await suite.dataSource
      .getRepository(ArticleEntity)
      .findOneByOrFail({ id });
    const events = await suite.dataSource
      .getRepository(AuditEventEntity)
      .count({ where: { subject_id: id } });
    const manager = suite.dataSource.manager;
    await manager.save(
      AccountTokenEntity,
      manager.create(AccountTokenEntity, {
        user: { id: author.user.id },
        type: AccountTokenType.PASSWORD_RESET,
        token_hash: 'unused-challenge',
        expires_at: new Date(Date.now() + 60_000),
        metadata: { private: 'data' },
      }),
    );
    await manager.save(
      UserMfaSettingsEntity,
      manager.create(UserMfaSettingsEntity, {
        user: { id: author.user.id },
        enabled: true,
      }),
    );
    await manager.save(
      UserPhoneEntity,
      manager.create(UserPhoneEntity, {
        profile: { id: author.user.profile.id },
        country: { id: author.user.profile.region.country!.id },
        phone_calling_code: '1',
        phone_national_number: '6135550199',
        phone_e164: '+16135550199',
      }),
    );
    await manager.insert(EmailIntentEntity, {
      delivery_id: 'tombstone-pending-email',
      state: 'pending',
      ciphertext: sealEmail({
        to: 'creator@example.test',
        subject: 'Security',
        htmlBody: 'Secret',
        messageStream: 'outbound',
        metadata: { userId: author.user.id },
      }),
      created_at: new Date(),
      available_at: new Date(Date.now() + 60_000),
      expires_at: new Date(Date.now() + 120_000),
    });
    await manager.insert(IdempotencyEntity, {
      scope_hash: 'f'.repeat(64),
      actor_id: admin.user.id,
      operation: 'identity.administration.user.update',
      route: `PATCH /api/v1/administration/users/${author.user.id}`,
      fingerprint: 'f'.repeat(64),
      state: 'completed',
      response_status: 200,
      response_body: {
        id: author.user.id,
        identity: { email: 'creator@example.test' },
      },
      response_identity: author.user.id,
      expires_at: new Date(Date.now() + 60_000),
    });
    for (const actor of [author, admin]) {
      await actor.agent
        .post('/api/v1/account/delete')
        .set(actor.headers)
        .send({ password: 'Valid!Pass1' })
        .expect(204);
      await actor.agent.get(CREATOR_ROOT).set(actor.headers).expect(404);
    }
    const article = await suite.dataSource
      .getRepository(ArticleEntity)
      .findOneByOrFail({ id });
    expect(await manager.count(AccountTokenEntity)).toBe(0);
    expect(await manager.count(UserSessionEntity)).toBe(0);
    expect(await manager.count(UserMfaSettingsEntity)).toBe(0);
    expect(await manager.count(UserPhoneEntity)).toBe(0);
    expect(await manager.count(RegistrationTokenEntity)).toBe(0);
    expect(
      await manager.findOneByOrFail(EmailIntentEntity, {
        delivery_id: 'tombstone-pending-email',
      }),
    ).toMatchObject({ state: 'cancelled', ciphertext: null });
    expect(
      await manager.findOneByOrFail(IdempotencyEntity, {
        scope_hash: 'f'.repeat(64),
      }),
    ).toMatchObject({ state: 'erased', response_body: null });
    expect(article.attribution.author?.id).toBe(before.attribution.author?.id);
    expect(article.publication.publisher?.id).toBe(
      before.publication.publisher?.id,
    );
    expect(article.version).toBe(before.version);
    expect(article.content).toEqual(before.content);
    expect(
      await suite.dataSource
        .getRepository(AuditEventEntity)
        .count({ where: { subject_id: id } }),
    ).toBe(events);
    const detail = await request(app.getHttpServer())
      .get(`${PUBLIC_ROOT}/${id}`)
      .expect(200);
    expect(detail.body.author).toMatchObject({
      id: before.attribution.author!.id,
      displayName:
        before.attribution.author!.profile.name.preferred ||
        `${before.attribution.author!.profile.name.first} ${before.attribution.author!.profile.name.last}`.trim(),
      avatar: null,
    });
    expect(detail.body.publisher).toMatchObject({
      id: before.publication.publisher!.id,
      displayName:
        before.publication.publisher!.profile.name.preferred ||
        `${before.publication.publisher!.profile.name.first} ${before.publication.publisher!.profile.name.last}`.trim(),
      avatar: null,
    });
    const list = await request(app.getHttpServer())
      .get(PUBLIC_ROOT)
      .expect(200);
    expect(list.body.data[0].author.displayName).toBe(
      detail.body.author.displayName,
    );
    expect(storage.objects.size).toBe(1);
    const retained = await suite.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: before.attribution.author!.id });
    expect(retained.status.key).toBe('deleted');
    expect(retained.identity.email).toMatch(
      /^deleted-[0-9a-f-]+@users\.invalid$/,
    );
    const replacement = await register(
      before.attribution.author!.identity.email,
    );
    expect(replacement.id).not.toBe(retained.id);
    expect(replacement.status.key).toBe('active');
    expect(retained.profile).toEqual(before.attribution.author!.profile);
  });

  it('rejects invalid content without changing articles, versions, audits, or uploads', async () => {
    const author = await creator();
    const created = await createDraft(author);
    const articleId = created.body.id as string;
    const snapshot = async () => ({
      articles: await suite.dataSource.getRepository(ArticleEntity).find(),
      audits: await suite.dataSource.getRepository(AuditEventEntity).count(),
      images: await suite.dataSource.getRepository(ImageEntity).find(),
      trackedUploads: await suite.dataSource
        .getRepository(StorageObjectEntity)
        .find(),
      objects: [...storage.objects.entries()],
    });
    const before = await snapshot();
    const oversized = [
      'a'.repeat(65_536),
      '漢'.repeat(21_845) + 'a',
      '😀'.repeat(16_383) + 'abcd',
    ];
    for (const body of oversized) {
      await author.agent
        .post(CREATOR_ROOT)
        .set(author.headers)
        .field('title', 'Invalid body')
        .field('summary', 'Summary')
        .field('body', body)
        .field('hero_alt_text', 'Hero')
        .attach('hero', PNG, 'hero.png')
        .expect(422);
      expect(await snapshot()).toEqual(before);
      expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);
    }
    for (const property of ['title', 'summary', 'body']) {
      const pending = author.agent.post(CREATOR_ROOT).set(author.headers);
      for (const field of ['title', 'summary', 'body']) {
        if (field !== property) pending.field(field, 'Content');
      }
      await pending
        .field('hero_alt_text', 'Hero')
        .attach('hero', PNG, 'hero.png')
        .expect(422);
      expect(await snapshot()).toEqual(before);
      expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);
    }
    for (const payload of [
      ...['title', 'summary', 'body'].map((property) => ({ [property]: null })),
      ...oversized.map((body) => ({ body })),
    ]) {
      await author.agent
        .patch(`${CREATOR_ROOT}/${articleId}`)
        .set(author.headers)
        .send({ expected_version: created.body.version, ...payload })
        .expect(422);
      expect(await snapshot()).toEqual(before);
    }
  });

  it.each([
    ['ASCII', 'a'.repeat(65_535)],
    ['three-byte', '漢'.repeat(21_845)],
    ['four-byte', '😀'.repeat(16_383) + 'abc'],
  ])(
    'persists exact TEXT boundaries for %s content and preserves omitted update fields',
    async (_label, body) => {
      const author = await creator();
      const created = await author.agent
        .post(CREATOR_ROOT)
        .set(author.headers)
        .field('title', 'Boundary')
        .field('summary', 'Summary')
        .field('body', body)
        .field('hero_alt_text', 'Hero')
        .attach('hero', PNG, 'hero.png')
        .expect(201);
      const repository = suite.dataSource.getRepository(ArticleEntity);
      const read = () =>
        repository.findOneByOrFail({ id: created.body.id as string });
      expect((await read()).content.body).toBe(body);
      const titleEdit = await author.agent
        .patch(`${CREATOR_ROOT}/${created.body.id}`)
        .set(author.headers)
        .send({ expected_version: created.body.version, title: 'New title' })
        .expect(200);
      expect((await read()).content).toMatchObject({
        title: 'New title',
        summary: 'Summary',
        body,
      });
      await author.agent
        .patch(`${CREATOR_ROOT}/${created.body.id}`)
        .set(author.headers)
        .send({ expected_version: titleEdit.body.version, body })
        .expect(200);
      const saved = await read();
      expect(saved.content).toMatchObject({
        title: 'New title',
        summary: 'Summary',
        body,
      });
      expect(saved.version).toBe(created.body.version + 2);
      expect(storage.objects.size).toBe(1);
      expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);
    },
  );

  it('rejects unspecified and contradictory multipart hero accessibility without persisting uploads', async () => {
    const author = await creator();
    for (const choice of ['missing', 'contradictory']) {
      const pending = author.agent
        .post(CREATOR_ROOT)
        .set(author.headers)
        .field('title', 'Accessibility required')
        .field('summary', 'Summary')
        .field('body', 'Body');
      if (choice === 'contradictory')
        pending
          .field('hero_decorative', 'true')
          .field('hero_alt_text', 'Contradictory description');
      await pending.attach('hero', PNG, 'hero.png').expect(422);
    }
    expect(storage.objects.size).toBe(0);
    expect(await suite.dataSource.getRepository(ArticleEntity).count()).toBe(0);
    expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);
  });

  it('blocks publication of legacy heroes without text or an explicit decorative choice', async () => {
    const author = await creator();
    const admin = await administrator();
    const created = await createDraft(author);
    const articleId = created.body.id as string;
    await suite.dataSource
      .getRepository(ImageEntity)
      .update(created.body.hero.id as string, {
        alt_text: null,
        decorative: false,
      });
    await author.agent
      .post(`${CREATOR_ROOT}/${articleId}/submit`)
      .set(author.headers)
      .send({ expected_version: await currentVersion(articleId) })
      .expect(200);
    const eventsBefore = await suite.dataSource
      .getRepository(AuditEventEntity)
      .count();
    await admin.agent
      .post(`${ADMINISTRATION_ROOT}/${articleId}/publish`)
      .set(admin.headers)
      .send({ expected_version: await currentVersion(articleId) })
      .expect(400);
    expect(await suite.dataSource.getRepository(AuditEventEntity).count()).toBe(
      eventsBefore,
    );
    await request(app.getHttpServer())
      .get(`${PUBLIC_ROOT}/${articleId}`)
      .expect(404);
  });

  it('covers creator, administration, public, storage, ownership, and audit behavior', async () => {
    const author = await creator();
    const otherCreator = await creator('other-creator@example.test');
    const admin = await administrator();

    const created = await createDraft(author);
    const articleId = created.body.id as string;
    const firstHeroId = created.body.hero.id as string;
    const firstStorageKey = [...storage.objects.keys()][0];

    expect(created.body).toMatchObject({
      id: articleId,
      title: 'Maintainable NestJS Articles',
      body: 'Confidential draft body that must not enter audit logs.',
      hero: {
        id: firstHeroId,
        altText: 'A small test image.',
      },
      author: { id: author.user.id },
      status: { key: 'draft' },
    });
    expect(firstStorageKey).toMatch(
      new RegExp(`^articles/${author.user.id}/heroes/`),
    );

    const creatorList = await author.agent
      .get(`${CREATOR_ROOT}?statusKey=draft&search=NestJS`)
      .set(author.headers)
      .expect(200);
    expect(creatorList.body.data).toEqual([
      expect.objectContaining({ id: articleId }),
    ]);
    await author.agent
      .get(`${CREATOR_ROOT}/${articleId}`)
      .set(author.headers)
      .expect(200);
    await otherCreator.agent
      .get(`${CREATOR_ROOT}/${articleId}`)
      .set(otherCreator.headers)
      .expect(404);

    await request(app.getHttpServer())
      .get(`${PUBLIC_ROOT}/${articleId}`)
      .expect(404);

    const contentUpdate = await author.agent
      .patch(`${CREATOR_ROOT}/${articleId}`)
      .set(author.headers)
      .send({
        expected_version: await currentVersion(articleId),
        title: 'Updated Maintainable NestJS Articles',
      })
      .expect(200);
    expect(contentUpdate.body.title).toBe(
      'Updated Maintainable NestJS Articles',
    );

    const replaced = await author.agent
      .put(`${CREATOR_ROOT}/${articleId}/hero`)
      .set(author.headers)
      .field('expected_version', String(await currentVersion(articleId)))
      .field('hero_alt_text', 'Replacement test image.')
      .attach('hero', PNG, {
        filename: 'replacement.png',
        contentType: 'image/png',
      })
      .expect(200);
    await drainStorageCleanup(app);
    const replacementStorageKey = [...storage.objects.keys()][0];
    expect(replaced.body.hero).toMatchObject({
      id: firstHeroId,
      altText: 'Replacement test image.',
    });
    expect(replacementStorageKey).not.toBe(firstStorageKey);
    expect(storage.objects.has(firstStorageKey)).toBe(false);

    await otherCreator.agent
      .put(`${CREATOR_ROOT}/${articleId}/hero`)
      .set(otherCreator.headers)
      .field('expected_version', String(await currentVersion(articleId)))
      .field('hero_alt_text', 'Unauthorized replacement')
      .attach('hero', PNG, {
        filename: 'unauthorized.png',
        contentType: 'image/png',
      })
      .expect(404);

    const submitted = await author.agent
      .post(`${CREATOR_ROOT}/${articleId}/submit`)
      .set(author.headers)
      .send({ expected_version: await currentVersion(articleId) })
      .expect(200);
    expect(submitted.body.status.key).toBe('submitted');

    const review = await admin.agent
      .get(
        `${ADMINISTRATION_ROOT}?statusKey=submitted&authorId=${author.user.id}`,
      )
      .set(admin.headers)
      .expect(200);
    expect(review.body.data).toEqual([
      expect.objectContaining({ id: articleId }),
    ]);
    await admin.agent
      .get(`${ADMINISTRATION_ROOT}/${articleId}`)
      .set(admin.headers)
      .expect(200);

    const withdrawn = await author.agent
      .post(`${CREATOR_ROOT}/${articleId}/withdraw`)
      .set(author.headers)
      .send({ expected_version: await currentVersion(articleId) })
      .expect(200);
    expect(withdrawn.body.status.key).toBe('draft');

    await author.agent
      .post(`${CREATOR_ROOT}/${articleId}/submit`)
      .set(author.headers)
      .send({ expected_version: await currentVersion(articleId) })
      .expect(200);
    await admin.agent
      .post(`${ADMINISTRATION_ROOT}/${articleId}/return-to-draft`)
      .set(admin.headers)
      .send({ expected_version: await currentVersion(articleId) })
      .expect(422);
    const returned = await admin.agent
      .post(`${ADMINISTRATION_ROOT}/${articleId}/return-to-draft`)
      .set(admin.headers)
      .send({
        expected_version: await currentVersion(articleId),
        reason_code: 'data_correction',
      })
      .expect(200);
    expect(returned.body.status.key).toBe('draft');

    await author.agent
      .post(`${CREATOR_ROOT}/${articleId}/submit`)
      .set(author.headers)
      .send({ expected_version: await currentVersion(articleId) })
      .expect(200);
    const published = await admin.agent
      .post(`${ADMINISTRATION_ROOT}/${articleId}/publish`)
      .set(admin.headers)
      .send({ expected_version: await currentVersion(articleId) })
      .expect(200);
    expect(published.body).toMatchObject({
      status: { key: 'published' },
      publisher: { id: admin.user.id },
    });
    expect(published.body.publishedAt).toEqual(expect.any(String));
    await author.agent
      .patch(`${CREATOR_ROOT}/${articleId}`)
      .set(author.headers)
      .send({
        expected_version: await currentVersion(articleId),
        title: 'Published articles are immutable',
      })
      .expect(400);

    const publicList = await request(app.getHttpServer())
      .get(`${PUBLIC_ROOT}?search=Updated`)
      .expect(200);
    expect(publicList.body.data).toEqual([
      expect.objectContaining({ id: articleId }),
    ]);
    await request(app.getHttpServer())
      .get(`${PUBLIC_ROOT}/${articleId}`)
      .expect(200);

    const archived = await admin.agent
      .post(`${ADMINISTRATION_ROOT}/${articleId}/archive`)
      .set(admin.headers)
      .send({
        expected_version: await currentVersion(articleId),
        reason_code: 'policy_enforcement',
      })
      .expect(200);
    expect(archived.body.status.key).toBe('archived');
    await request(app.getHttpServer())
      .get(`${PUBLIC_ROOT}/${articleId}`)
      .expect(404);

    const restored = await admin.agent
      .post(`${ADMINISTRATION_ROOT}/${articleId}/restore`)
      .set(admin.headers)
      .send({
        expected_version: await currentVersion(articleId),
        reason_code: 'data_correction',
      })
      .expect(200);
    expect(restored.body).toMatchObject({
      status: { key: 'draft' },
      publisher: null,
      publishedAt: null,
    });

    const events = await suite.dataSource
      .getRepository(AuditEventEntity)
      .find({ where: { subject_id: articleId }, order: { createdAt: 'ASC' } });
    const eventNames = events.map(({ event }) => event);
    expect(eventNames).toEqual(
      expect.arrayContaining([
        ArticleAuditEvents.CREATED,
        ArticleAuditEvents.UPDATED,
        ArticleAuditEvents.HERO_REPLACED,
        ArticleAuditEvents.SUBMITTED,
        ArticleAuditEvents.WITHDRAWN,
        ArticleAuditEvents.RETURNED_TO_DRAFT,
        ArticleAuditEvents.PUBLISHED,
        ArticleAuditEvents.ARCHIVED,
        ArticleAuditEvents.RESTORED,
      ]),
    );
    expect(
      events.filter(({ event }) => event === ArticleAuditEvents.SUBMITTED),
    ).toHaveLength(3);
    expect(
      events.find(({ event }) => event === ArticleAuditEvents.RETURNED_TO_DRAFT)
        ?.metadata,
    ).toEqual({ reason_code: 'data_correction' });
    expect(
      events.find(({ event }) => event === ArticleAuditEvents.ARCHIVED)
        ?.metadata,
    ).toEqual({ reason_code: 'policy_enforcement' });
    expect(JSON.stringify(events)).not.toContain(
      'Confidential draft body that must not enter audit logs.',
    );
  });

  it('rolls back an article mutation when its audit insert fails', async () => {
    const author = await creator();
    const created = await createDraft(author);
    const articleId = created.body.id as string;
    const audit = app.get(AuditService);
    const implementation = audit.record.bind(audit);
    const insertion = jest
      .spyOn(audit, 'record')
      .mockImplementation((input, manager) => {
        if (input.event === ArticleAuditEvents.UPDATED)
          return Promise.reject(new Error('simulated audit insert failure'));
        return implementation(input, manager);
      });

    await author.agent
      .patch(`${CREATOR_ROOT}/${articleId}`)
      .set(author.headers)
      .send({
        expected_version: await currentVersion(articleId),
        title: 'Must roll back',
      })
      .expect(500);
    insertion.mockRestore();

    const stored = await suite.dataSource
      .getRepository(ArticleEntity)
      .findOneByOrFail({ id: articleId });
    expect(stored.content.title).toBe('Maintainable NestJS Articles');
    expect(stored.version).toBe(created.body.version);
    expect(
      await suite.dataSource.getRepository(AuditEventEntity).existsBy({
        event: ArticleAuditEvents.UPDATED,
        resource_id: articleId,
      }),
    ).toBe(false);
  });

  it('removes a new hero object when article creation rolls back', async () => {
    const author = await creator();
    const audit = app.get(AuditService);
    const implementation = audit.record.bind(audit);
    const insertion = jest
      .spyOn(audit, 'record')
      .mockImplementation((input, manager) => {
        if (input.event === ArticleAuditEvents.CREATED)
          return Promise.reject(new Error('simulated audit insert failure'));
        return implementation(input, manager);
      });

    try {
      await author.agent
        .post(CREATOR_ROOT)
        .set(author.headers)
        .field('title', 'Creation must roll back')
        .field('summary', 'Storage must roll back with the database.')
        .field('body', 'Body')
        .field('hero_alt_text', 'A small test image.')
        .attach('hero', PNG, {
          filename: 'rollback.png',
          contentType: 'image/png',
        })
        .expect(500);
    } finally {
      insertion.mockRestore();
    }

    expect(storage.objects.size).toBe(1);
    await drainStorageCleanup(app);
    expect(storage.objects.size).toBe(0);
    expect(await suite.dataSource.getRepository(ArticleEntity).count()).toBe(0);
    expect(await suite.dataSource.getRepository(ImageEntity).count()).toBe(0);
  });

  it('preserves the old hero and removes its replacement when replacement rolls back', async () => {
    const author = await creator();
    const created = await createDraft(author);
    const articleId = created.body.id as string;
    const oldStorageKey = [...storage.objects.keys()][0];
    const audit = app.get(AuditService);
    const implementation = audit.record.bind(audit);
    const insertion = jest
      .spyOn(audit, 'record')
      .mockImplementation((input, manager) => {
        if (input.event === ArticleAuditEvents.HERO_REPLACED)
          return Promise.reject(new Error('simulated audit insert failure'));
        return implementation(input, manager);
      });

    try {
      await author.agent
        .put(`${CREATOR_ROOT}/${articleId}/hero`)
        .set(author.headers)
        .field('expected_version', String(await currentVersion(articleId)))
        .field('hero_alt_text', 'Replacement that must roll back.')
        .attach('hero', PNG, {
          filename: 'rollback-replacement.png',
          contentType: 'image/png',
        })
        .expect(500);
    } finally {
      insertion.mockRestore();
    }

    const stored = await suite.dataSource
      .getRepository(ArticleEntity)
      .findOneByOrFail({ id: articleId });
    expect(stored.media.hero.storage_key).toBe(oldStorageKey);
    expect(stored.version).toBe(created.body.version);
    expect(storage.objects.size).toBe(2);
    await drainStorageCleanup(app);
    expect([...storage.objects.keys()]).toEqual([oldStorageKey]);
    expect(
      await suite.dataSource.getRepository(AuditEventEntity).existsBy({
        event: ArticleAuditEvents.HERO_REPLACED,
        resource_id: articleId,
      }),
    ).toBe(false);
  });
});
