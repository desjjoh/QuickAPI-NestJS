import type { INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import request from 'supertest';

import { MAX_VERIFICATION_CODE_ATTEMPTS } from '@/config/token.config';
import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';
import { RegistrationTokenEntity } from '@/modules/domain/identity/entities/registration-token.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { ROLE_KEYS } from '@/modules/domain/library/seeders/role.seeder';
import {
  acquireCsrf,
  CapturingEmailService,
  REGISTRATION_ROOT,
  requestRegistration,
  setupAuthenticationSuite,
} from './authentication-e2e.helpers';
import { teardownTestSuite, type TestSuite } from '../../helpers/test-app';

describe('Registration email verification', () => {
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

  it('consumes a valid challenge and creates one active user with the default role', async () => {
    const pending = await requestRegistration(app, suite.dataSource);
    const challengeId = pending.response.body.challenge_id as string;
    const code = email.verificationCodeFor(challengeId);

    const response = await pending.agent
      .post(`${REGISTRATION_ROOT}/confirm`)
      .set('x-csrf-token', pending.csrf)
      .send({ challenge_id: challengeId, code })
      .expect(200);

    expect(response.body).toMatchObject({
      access_token: expect.any(String),
      iat: expect.any(Number),
      exp: expect.any(Number),
      refresh: expect.any(Number),
      user: expect.objectContaining({
        identity: expect.objectContaining({ email: 'person@example.test' }),
      }),
    });
    expect(response.body.user.identity).not.toHaveProperty('password');
    const user = await suite.dataSource
      .getRepository(UserEntity)
      .findOneOrFail({ where: { identity: { email: 'person@example.test' } } });
    expect(user.status.key).toBe(ACCOUNT_STATUS_KEYS.ACTIVE);
    expect(user.roles?.map((role) => role.key)).toEqual([ROLE_KEYS.USER]);
    const token = await suite.dataSource
      .getRepository(RegistrationTokenEntity)
      .findOneByOrFail({ id: challengeId });
    expect(token.consumed_at).toBeInstanceOf(Date);
    expect(email.messages).toContainEqual(
      expect.objectContaining({
        to: 'person@example.test',
        templateKey: 'registration-success',
      }),
    );

    await pending.agent
      .post(`${REGISTRATION_ROOT}/request`)
      .set('x-csrf-token', pending.csrf)
      .send(pending.payload)
      .expect(409);
    expect(await suite.dataSource.getRepository(UserEntity).count()).toBe(1);
  });

  it('rejects invalid and unknown challenges without creating an account', async () => {
    const pending = await requestRegistration(app, suite.dataSource);
    const validCode = email.verificationCodeFor(
      pending.response.body.challenge_id as string,
    );
    const invalidCode = validCode === '000000' ? '999999' : '000000';
    await pending.agent
      .post(`${REGISTRATION_ROOT}/confirm`)
      .set('x-csrf-token', pending.csrf)
      .send({
        challenge_id: pending.response.body.challenge_id,
        code: invalidCode,
      })
      .expect(401);
    await pending.agent
      .post(`${REGISTRATION_ROOT}/confirm`)
      .set('x-csrf-token', pending.csrf)
      .send({ challenge_id: 'unknown-challenge', code: '000000' })
      .expect(401);
    expect(await suite.dataSource.getRepository(UserEntity).count()).toBe(0);
  });

  it('rejects an expired challenge', async () => {
    const pending = await requestRegistration(app, suite.dataSource);
    const challengeId = pending.response.body.challenge_id as string;
    await suite.dataSource
      .getRepository(RegistrationTokenEntity)
      .update(challengeId, { expires_at: new Date(Date.now() - 1_000) });

    await pending.agent
      .post(`${REGISTRATION_ROOT}/confirm`)
      .set('x-csrf-token', pending.csrf)
      .send({
        challenge_id: challengeId,
        code: email.verificationCodeFor(challengeId),
      })
      .expect(401);
    expect(await suite.dataSource.getRepository(UserEntity).count()).toBe(0);
  });

  it('locks a challenge after the maximum failed attempts', async () => {
    const pending = await requestRegistration(app, suite.dataSource);
    const challengeId = pending.response.body.challenge_id as string;
    const validCode = email.verificationCodeFor(challengeId);
    const invalidCode = validCode === '000000' ? '999999' : '000000';

    for (
      let attempt = 0;
      attempt < MAX_VERIFICATION_CODE_ATTEMPTS;
      attempt += 1
    ) {
      await pending.agent
        .post(`${REGISTRATION_ROOT}/confirm`)
        .set('x-csrf-token', pending.csrf)
        .send({ challenge_id: challengeId, code: invalidCode })
        .expect(401);
    }
    const token = await suite.dataSource
      .getRepository(RegistrationTokenEntity)
      .findOneByOrFail({ id: challengeId });
    expect(token.failed_attempts).toBe(MAX_VERIFICATION_CODE_ATTEMPTS);
    expect(token.locked_at).toBeInstanceOf(Date);
    expect(await suite.dataSource.getRepository(UserEntity).count()).toBe(0);
  });

  it('rejects an already-consumed challenge', async () => {
    const pending = await requestRegistration(app, suite.dataSource);
    const challengeId = pending.response.body.challenge_id as string;
    const body = {
      challenge_id: challengeId,
      code: email.verificationCodeFor(challengeId),
    };
    await pending.agent
      .post(`${REGISTRATION_ROOT}/confirm`)
      .set('x-csrf-token', pending.csrf)
      .send(body)
      .expect(200);
    await pending.agent
      .post(`${REGISTRATION_ROOT}/confirm`)
      .set('x-csrf-token', pending.csrf)
      .send(body)
      .expect(401);
    expect(await suite.dataSource.getRepository(UserEntity).count()).toBe(1);
  });

  it('rejects malformed DTOs and missing or invalid CSRF credentials', async () => {
    const pending = await requestRegistration(app, suite.dataSource);
    await pending.agent
      .post(`${REGISTRATION_ROOT}/confirm`)
      .set('x-csrf-token', pending.csrf)
      .send({ challenge_id: '', code: 'abc' })
      .expect(422);
    await request(app.getHttpServer())
      .post(`${REGISTRATION_ROOT}/confirm`)
      .send({
        challenge_id: pending.response.body.challenge_id,
        code: '000000',
      })
      .expect(403);
    await pending.agent
      .post(`${REGISTRATION_ROOT}/confirm`)
      .set('x-csrf-token', 'invalid')
      .send({
        challenge_id: pending.response.body.challenge_id,
        code: '000000',
      })
      .expect(403);
    expect(await suite.dataSource.getRepository(UserEntity).count()).toBe(0);
  });

  it('allows only one account to result from concurrent verification attempts', async () => {
    const pending = await requestRegistration(app, suite.dataSource);
    const challengeId = pending.response.body.challenge_id as string;
    const body = {
      challenge_id: challengeId,
      code: email.verificationCodeFor(challengeId),
    };
    const secondAgent = request.agent(app.getHttpServer());
    const secondCsrf = await acquireCsrf(secondAgent);

    const responses = await Promise.all([
      pending.agent
        .post(`${REGISTRATION_ROOT}/confirm`)
        .set('x-csrf-token', pending.csrf)
        .send(body),
      secondAgent
        .post(`${REGISTRATION_ROOT}/confirm`)
        .set('x-csrf-token', secondCsrf)
        .send(body),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 401,
    ]);
    expect(await suite.dataSource.getRepository(UserEntity).count()).toBe(1);
    expect(
      await suite.dataSource
        .getRepository(UserEntity)
        .countBy({ identity: { email: 'person@example.test' } }),
    ).toBe(1);
  });
});
