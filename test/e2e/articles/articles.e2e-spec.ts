import type { INestApplication } from '@nestjs/common';
import { getOptionsToken } from '@nestjs/throttler';
import { mkdir, rm, readdir } from 'node:fs/promises';
import request from 'supertest';
import { jest } from '@jest/globals';

import { env } from '@/config/environment.config';
import { ArticleAuditEvents } from '@/config/audit-events.config';
import { ArticleEntity } from '@/modules/domain/articles/entities/article.entity';
import { AuditEventEntity } from '@/modules/domain/audit/entities/audit-event.entity';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { ImageEntity } from '@/modules/domain/media/entities/image.entity';
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

const PUBLIC_ROOT = '/api/v1/public/articles';
const CREATOR_ROOT = '/api/v1/creator/articles';
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
    await auth.agent.get(CREATOR_ROOT).set(auth.headers).expect(403);
    await request(app.getHttpServer()).get(ADMINISTRATION_ROOT).expect(401);
    await auth.agent.get(ADMINISTRATION_ROOT).set(auth.headers).expect(403);
  });

  it('isolates creator routing from public article ID matching and retires the old paths', async () => {
    const author = await creator();
    const response = await author.agent
      .get(CREATOR_ROOT)
      .set(author.headers)
      .expect(200);
    expect(response.body.data).toEqual([]);
    await request(app.getHttpServer()).get(CREATOR_ROOT).expect(401);
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
    expect([...storage.objects.keys()]).toEqual([oldStorageKey]);
    expect(
      await suite.dataSource.getRepository(AuditEventEntity).existsBy({
        event: ArticleAuditEvents.HERO_REPLACED,
        resource_id: articleId,
      }),
    ).toBe(false);
  });
});
