import { AuditSubjectType } from '@/config/audit-events.config';
import type { INestApplication } from '@nestjs/common';
import { getOptionsToken } from '@nestjs/throttler';
import request from 'supertest';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import { EmailService } from '@/modules/system/email/services/email.service';
import {
  acquireCsrf,
  CapturingEmailService,
  createRegisteredUser,
} from '../authentication/authentication-e2e.helpers';
import {
  setupTestSuite,
  teardownTestSuite,
  TestSuite,
} from '../../helpers/test-app';

describe('account activity', () => {
  let suite: TestSuite;
  let app: INestApplication;
  let email: CapturingEmailService;

  beforeAll(async () => {
    email = new CapturingEmailService();
    suite = await setupTestSuite((builder) =>
      builder
        .overrideProvider(EmailService)
        .useValue(email)
        .overrideProvider(getOptionsToken())
        .useValue({
          skipIf: () => true,
          throttlers: [{ name: 'default', limit: 1, ttl: 60_000 }],
        }),
    );
    app = suite.app;
  });

  afterEach(async () => {
    email.clear();
    await suite.resetDatabase();
  });
  afterAll(() => teardownTestSuite(suite));

  it('returns only events where the authenticated user is the actor', async () => {
    const user = await createRegisteredUser(app, suite, email);
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const signIn = await agent
      .post('/api/v1/authentication/sign-in')
      .set('x-csrf-token', csrf)
      .send({ email: 'person@example.test', password: 'Valid!Pass1' })
      .expect(201);
    const headers = {
      authorization: `Bearer ${signIn.body.access_token as string}`,
      'x-csrf-token': csrf,
    };
    const audit = app.get(AuditService);
    const base = {
      outcome: 'succeeded' as const,
      source: 'service' as const,
      domain: 'activity_test',
      metadata: { administratorNote: 'must not be returned' },
      ipAddress: '192.0.2.1',
      userAgent: 'private-client',
    };
    await audit.record({
      ...base,
      event: 'activity_test.self.first',
      actorType: 'user',
      actorId: user.id,
      subjectType: AuditSubjectType.USER,
      subjectId: 'somebody-else',
      occurredAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await audit.record({
      ...base,
      event: 'activity_test.other.touched.me',
      actorType: 'admin',
      actorId: 'other-actor-id',
      subjectType: AuditSubjectType.USER,
      subjectId: user.id,
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const response = await agent
      .get('/api/v1/account/activity?domain=activity_test&take=1')
      .set(headers)
      .expect(200);

    expect(response.body).toEqual({
      data: [
        expect.objectContaining({
          domain: 'activity_test',
          event: 'activity_test.other.touched.me',
          outcome: 'succeeded',
        }),
      ],
      meta: {
        page: 1,
        take: 1,
        itemCount: 1,
        pageCount: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });
    expect(response.body.data[0]).not.toHaveProperty('actorId');
    expect(response.body.data[0]).not.toHaveProperty('metadata');
    expect(response.body.data[0]).not.toHaveProperty('failureReason');
    expect(response.body.data[0]).not.toHaveProperty('ipAddress');
    expect(response.body.data[0]).not.toHaveProperty('userAgent');

    await agent
      .get(`/api/v1/account/activity?actorId=${user.id}`)
      .set(headers)
      .expect(422);
  });

  it('page-paginates the authenticated account history', async () => {
    const user = await createRegisteredUser(app, suite, email);
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const signIn = await agent
      .post('/api/v1/authentication/sign-in')
      .set('x-csrf-token', csrf)
      .send({ email: 'person@example.test', password: 'Valid!Pass1' })
      .expect(201);
    const headers = {
      authorization: `Bearer ${signIn.body.access_token as string}`,
      'x-csrf-token': csrf,
    };
    const audit = app.get(AuditService);
    for (const [event, day] of [
      ['page_test.page.newer', '03'],
      ['page_test.page.older', '02'],
    ])
      await audit.record({
        event,
        outcome: 'succeeded',
        actorType: 'user',
        actorId: user.id,
        subjectType: AuditSubjectType.USER,
        subjectId: user.id,
        source: 'service',
        domain: 'page_test',
        metadata: {},
        occurredAt: new Date(`2026-01-${day}T00:00:00.000Z`),
      });

    const first = await agent
      .get('/api/v1/account/activity?domain=page_test&take=1')
      .set(headers)
      .expect(200);
    expect(first.body.data[0].event).toBe('page_test.page.newer');
    expect(first.body.meta).toEqual({
      page: 1,
      take: 1,
      itemCount: 2,
      pageCount: 2,
      hasPreviousPage: false,
      hasNextPage: true,
    });
    const second = await agent
      .get('/api/v1/account/activity?domain=page_test&take=1&page=2')
      .set(headers)
      .expect(200);
    expect(
      second.body.data.map((item: { event: string }) => item.event),
    ).toEqual(['page_test.page.older']);
    expect(second.body.meta).toEqual({
      page: 2,
      take: 1,
      itemCount: 2,
      pageCount: 2,
      hasPreviousPage: true,
      hasNextPage: false,
    });
  });
});
