import {
  INestApplication,
  Module,
  ExecutionContext,
  ValidationPipe,
} from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';

import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { ArticlesModule } from '@/modules/domain/articles/articles.module';
import { ArticleService } from '@/modules/domain/articles/services/article.service';
import { ArticleStatusTransitionPolicy } from '@/modules/domain/articles/policies/article-status-transition.policy';
import { ArticleEntity } from '@/modules/domain/articles/entities/article.entity';
import { AuditModule } from '@/modules/domain/audit/audit.module';
import { ArticlesApiModule } from '@/modules/api/v1/articles/articles.module';
import { AuthoringArticleController } from '@/modules/api/v1/articles/controllers/authoring-articles.controller';
import { TokenModule } from '@/modules/system/tokens/token.module';
import { AuthoringArticleApiService } from '@/modules/api/v1/articles/services/authoring-articles.service';
import { apiV1Routes } from '@/modules/api/v1/v1.module';
import { IdempotencyModule } from '@/modules/system/idempotency/idempotency.module';
import { IdempotencyInterceptor } from '@/common/interceptors/idempotency.interceptor';

@Module({})
class EmptyDomainModule {}

// Exercise authoring HTTP behavior using the production article route registration.
@Module({
  imports: [ArticlesModule, AuditModule, TokenModule, IdempotencyModule],
  controllers: [AuthoringArticleController],
  providers: [AuthoringArticleApiService],
})
class AccountArticlesTestModule {}

describe('creator article HTTP concurrency', () => {
  let app: INestApplication;
  let stored: ArticleEntity;
  const id = 'A1b2C3d4E5f6G7h8';
  const audit = { record: jest.fn(async () => undefined) };
  beforeAll(async () => {
    const manager = {
      transaction: async (work: (value: unknown) => Promise<unknown>) =>
        work(manager),
      update: async (
        _entity: unknown,
        criteria: { version: number },
        input: { content?: object },
      ) => {
        if (criteria.version !== stored.version) return { affected: 0 };
        stored = {
          ...stored,
          version: stored.version + 1,
          content: { ...stored.content, ...input.content },
        };
        return { affected: 1 };
      },
    };
    const repo = {
      manager,
      findById: async () => structuredClone(stored),
      findByIdAndAuthorForUpdate: async () => structuredClone(stored),
    };
    const domain = new ArticleService(
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      new ArticleStatusTransitionPolicy(),
    );
    const service = new AuthoringArticleApiService(domain, audit as never);
    const module = await Test.createTestingModule({
      imports: [
        AccountArticlesTestModule,
        RouterModule.register([
          {
            path: 'api',
            children: apiV1Routes.map((route) => ({
              ...route,
              children: route.children?.map((child) =>
                typeof child === 'function'
                  ? child
                  : {
                      ...child,
                      module:
                        child.module === ArticlesApiModule
                          ? AccountArticlesTestModule
                          : child.module,
                    },
              ),
            })),
          },
        ]),
      ],
    })
      .overrideModule(ArticlesModule)
      .useModule(EmptyDomainModule)
      .overrideModule(AuditModule)
      .useModule(EmptyDomainModule)
      .overrideModule(IdempotencyModule)
      .useModule(EmptyDomainModule)
      .overrideInterceptor(IdempotencyInterceptor)
      .useValue({
        intercept: (_context: unknown, next: { handle: () => unknown }) =>
          next.handle(),
      })
      .overrideProvider(AuthoringArticleApiService)
      .useValue(service)
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CsrfGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = {
            userEntity: { id: 'creator-1' },
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  beforeEach(() => {
    audit.record.mockClear();
    stored = {
      id,
      version: 1,
      content: { title: 'Original', summary: 'Summary', body: 'Body' },
      media: { hero: { id: 'hero-1', storage_key: 'hero.png' } },
      attribution: { author: null },
      publication: {
        status: { key: 'draft' },
        publisher: null,
        publishedAt: null,
      },
    } as ArticleEntity;
  });
  afterAll(async () => {
    await app?.close();
  });

  it('returns one success and one 409 for edits sharing a version', async () => {
    const responses = await Promise.all(
      ['First', 'Second'].map((title) =>
        request(app.getHttpServer())
          .patch(`/api/v1/articles/me/${id}`)
          .send({ title, expected_version: 1 }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      responses.find((response) => response.status === 200)?.body.version,
    ).toBe(2);
    expect(stored.version).toBe(2);
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it.each(['patch', 'submit', 'withdraw'])(
    'requires expected_version for %s',
    async (action) => {
      const pending =
        action === 'patch'
          ? request(app.getHttpServer())
              .patch(`/api/v1/articles/me/${id}`)
              .send({ title: 'Edit' })
          : request(app.getHttpServer())
              .post(`/api/v1/articles/me/${id}/${action}`)
              .send({});
      await pending.expect(400);
      expect(stored.version).toBe(1);
      expect(audit.record).not.toHaveBeenCalled();
    },
  );

  it('documents required versions and conflict responses in Swagger', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    expect(doc.components?.schemas?.UpdateArticleDto).toEqual(
      expect.objectContaining({
        required: expect.arrayContaining(['expected_version']),
      }),
    );
    expect(doc.components?.schemas?.UpdateArticleHeroDto).toEqual(
      expect.objectContaining({
        required: expect.arrayContaining(['expected_version']),
      }),
    );
    expect(
      doc.paths['/api/v1/articles/me/{id}/submit'].post?.responses['409'],
    ).toBeDefined();
    expect(doc.components?.schemas?.ArticleManagementDto).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({ version: expect.anything() }),
      }),
    );
  });
});
