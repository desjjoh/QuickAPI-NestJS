import type { INestApplication } from '@nestjs/common';
import { getOptionsToken } from '@nestjs/throttler';
import { mkdir, rm } from 'node:fs/promises';
import request from 'supertest';
import { jest } from '@jest/globals';

import { env } from '@/config/environment.config';
import { ArticleAuditEvents } from '@/config/audit-events.config';
import { ArticleEntity } from '@/modules/domain/articles/entities/article.entity';
import { AuditEventEntity } from '@/modules/domain/audit/entities/audit-event.entity';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
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

const PUBLIC_ROOT = '/api/v1/articles';
const CREATOR_ROOT = `${PUBLIC_ROOT}/creator`;
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

  async function createDraft(auth: AuthenticatedAgent) {
    return auth.agent
      .post(CREATOR_ROOT)
      .set(auth.headers)
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
    await auth.agent.get(CREATOR_ROOT).set(auth.headers).expect(403);
    await request(app.getHttpServer()).get(ADMINISTRATION_ROOT).expect(401);
    await auth.agent.get(ADMINISTRATION_ROOT).set(auth.headers).expect(403);
  });

  it('validates the multipart article creation contract', async () => {
    const auth = await creator();

    await auth.agent
      .post(CREATOR_ROOT)
      .set(auth.headers)
      .field('title', 'Missing hero')
      .field('summary', 'Summary')
      .field('body', 'Body')
      .expect(400);

    await auth.agent
      .post(CREATOR_ROOT)
      .set(auth.headers)
      .field('title', 'Unsupported hero')
      .field('summary', 'Summary')
      .field('body', 'Body')
      .attach('hero', Buffer.from('not an image'), {
        filename: 'hero.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    expect(storage.objects.size).toBe(0);
    expect(await suite.dataSource.getRepository(ArticleEntity).count()).toBe(0);
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
      .send({ title: 'Updated Maintainable NestJS Articles' })
      .expect(200);
    expect(contentUpdate.body.title).toBe(
      'Updated Maintainable NestJS Articles',
    );

    const replaced = await author.agent
      .put(`${CREATOR_ROOT}/${articleId}/hero`)
      .set(author.headers)
      .field('hero_alt_text', 'Replacement test image.')
      .attach('hero', PNG, {
        filename: 'replacement.png',
        contentType: 'image/png',
      })
      .expect(200);
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
      .attach('hero', PNG, {
        filename: 'unauthorized.png',
        contentType: 'image/png',
      })
      .expect(404);

    const submitted = await author.agent
      .post(`${CREATOR_ROOT}/${articleId}/submit`)
      .set(author.headers)
      .send({})
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
      .send({})
      .expect(200);
    expect(withdrawn.body.status.key).toBe('draft');

    await author.agent
      .post(`${CREATOR_ROOT}/${articleId}/submit`)
      .set(author.headers)
      .send({})
      .expect(200);
    await admin.agent
      .post(`${ADMINISTRATION_ROOT}/${articleId}/return-to-draft`)
      .set(admin.headers)
      .send({})
      .expect(422);
    const returned = await admin.agent
      .post(`${ADMINISTRATION_ROOT}/${articleId}/return-to-draft`)
      .set(admin.headers)
      .send({ reason_code: 'data_correction' })
      .expect(200);
    expect(returned.body.status.key).toBe('draft');

    await author.agent
      .post(`${CREATOR_ROOT}/${articleId}/submit`)
      .set(author.headers)
      .send({})
      .expect(200);
    const published = await admin.agent
      .post(`${ADMINISTRATION_ROOT}/${articleId}/publish`)
      .set(admin.headers)
      .send({})
      .expect(200);
    expect(published.body).toMatchObject({
      status: { key: 'published' },
      publisher: { id: admin.user.id },
    });
    expect(published.body.publishedAt).toEqual(expect.any(String));
    await author.agent
      .patch(`${CREATOR_ROOT}/${articleId}`)
      .set(author.headers)
      .send({ title: 'Published articles are immutable' })
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
      .send({ reason_code: 'policy_enforcement' })
      .expect(200);
    expect(archived.body.status.key).toBe('archived');
    await request(app.getHttpServer())
      .get(`${PUBLIC_ROOT}/${articleId}`)
      .expect(404);

    const restored = await admin.agent
      .post(`${ADMINISTRATION_ROOT}/${articleId}/restore`)
      .set(admin.headers)
      .send({ reason_code: 'data_correction' })
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
      .send({ title: 'Must roll back' })
      .expect(500);
    insertion.mockRestore();

    const stored = await suite.dataSource
      .getRepository(ArticleEntity)
      .findOneByOrFail({ id: articleId });
    expect(stored.content.title).toBe('Maintainable NestJS Articles');
    expect(
      await suite.dataSource.getRepository(AuditEventEntity).existsBy({
        event: ArticleAuditEvents.UPDATED,
        resource_id: articleId,
      }),
    ).toBe(false);
  });
});
