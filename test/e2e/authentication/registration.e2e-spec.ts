import type { INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import request from 'supertest';

import { RegistrationTokenEntity } from '@/modules/domain/identity/entities/registration-token.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import {
  acquireCsrf,
  CapturingEmailService,
  REGISTRATION_ROOT,
  registrationPayload,
  setupAuthenticationSuite,
} from './authentication-e2e.helpers';
import { teardownTestSuite, type TestSuite } from '../../helpers/test-app';

describe('Registration request', () => {
  let app: INestApplication;
  let suite: TestSuite;
  let email: CapturingEmailService;

  beforeAll(async () => {
    ({ suite, email } = await setupAuthenticationSuite());
    app = suite.app;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    email.clear();
    await suite.resetDatabase();
  });

  afterAll(async () => teardownTestSuite(suite));

  it('acquires CSRF protection and persists a normalized pending registration', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const payload = {
      ...(await registrationPayload(suite.dataSource)),
      email: 'Person@Example.Test',
    };

    const response = await agent
      .post(`${REGISTRATION_ROOT}/request`)
      .set('x-csrf-token', csrf)
      .send(payload)
      .expect(201);

    expect(response.body).toMatchObject({
      message: 'Registration pending. Please verify your email address.',
      email: 'person@example.test',
      challenge_id: expect.any(String),
      method: 'email_otp',
      expires_at: expect.any(String),
    });
    expect(await suite.dataSource.getRepository(UserEntity).count()).toBe(0);

    const pending = await suite.dataSource
      .getRepository(RegistrationTokenEntity)
      .findOneByOrFail({ id: response.body.challenge_id as string });
    expect(pending.email).toBe('person@example.test');
    expect(pending.metadata.email).toBe('person@example.test');
    expect(pending.metadata.password).not.toBe(payload.password);
    expect(pending.consumed_at).toBeNull();
    expect(email.messages).toContainEqual(
      expect.objectContaining({
        to: 'person@example.test',
        templateKey: 'registration-verification',
        metadata: expect.objectContaining({ tokenId: pending.id }),
      }),
    );
    expect(email.verificationCodeFor(pending.id)).toMatch(/^\d{6}$/);
  });

  it('replaces a duplicate pending request and resends an existing pending registration', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const payload = await registrationPayload(suite.dataSource);
    const first = await agent
      .post(`${REGISTRATION_ROOT}/request`)
      .set('x-csrf-token', csrf)
      .send(payload)
      .expect(201);
    const duplicate = await agent
      .post(`${REGISTRATION_ROOT}/request`)
      .set('x-csrf-token', csrf)
      .send(payload)
      .expect(201);

    expect(duplicate.body.challenge_id).not.toBe(first.body.challenge_id);
    const firstToken = await suite.dataSource
      .getRepository(RegistrationTokenEntity)
      .findOneByOrFail({ id: first.body.challenge_id as string });
    expect(firstToken.consumed_at).toBeInstanceOf(Date);

    const resent = await agent
      .post(`${REGISTRATION_ROOT}/resend`)
      .set('x-csrf-token', csrf)
      .send({ email: payload.email.toUpperCase() })
      .expect(200);
    expect(resent.body).toMatchObject({
      email: payload.email.toLowerCase(),
      challenge_id: expect.any(String),
    });
    expect(resent.body.challenge_id).not.toBe(duplicate.body.challenge_id);
    expect(
      email.messages.filter(
        (item) => item.templateKey === 'registration-verification',
      ),
    ).toHaveLength(3);
  });

  it.each([
    ['missing required fields', { first_name: undefined }],
    ['invalid field formats', { email: 'not-an-email', password: 'short' }],
    ['unknown fields', { unexpected: true }],
  ])('rejects malformed DTOs: %s', async (_label, override) => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const payload = {
      ...(await registrationPayload(suite.dataSource)),
      ...override,
    };
    await agent
      .post(`${REGISTRATION_ROOT}/request`)
      .set('x-csrf-token', csrf)
      .send(payload)
      .expect(422);
    expect(
      await suite.dataSource.getRepository(RegistrationTokenEntity).count(),
    ).toBe(0);
  });

  it('rejects missing and invalid CSRF credentials without changing state', async () => {
    const payload = await registrationPayload(suite.dataSource);
    await request(app.getHttpServer())
      .post(`${REGISTRATION_ROOT}/request`)
      .send(payload)
      .expect(403);
    const agent = request.agent(app.getHttpServer());
    await acquireCsrf(agent);
    await agent
      .post(`${REGISTRATION_ROOT}/request`)
      .set('x-csrf-token', 'invalid')
      .send(payload)
      .expect(403);
    expect(
      await suite.dataSource.getRepository(RegistrationTokenEntity).count(),
    ).toBe(0);
    expect(email.messages).toHaveLength(0);
  });
});
