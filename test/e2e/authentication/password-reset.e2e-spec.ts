import type { INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import request from 'supertest';
import { IsNull } from 'typeorm';

import {
  MAX_VERIFICATION_CODE_ATTEMPTS,
  AccountTokenType,
} from '@/config/token.config';
import { AccountTokenEntity } from '@/modules/domain/identity/entities/account-token.entity';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import {
  acquireCsrf,
  CapturingEmailService,
  createRegisteredUser,
  setupAuthenticationSuite,
} from './authentication-e2e.helpers';
import { teardownTestSuite, type TestSuite } from '../../helpers/test-app';

const ROOT = '/api/v1/authentication/password-reset';
const AUTH_ROOT = '/api/v1/authentication';
const OLD_PASSWORD = 'Valid!Pass1';
const NEW_PASSWORD = 'New!Pass2';

describe('Password reset', () => {
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

  async function requestReset(address = 'person@example.test') {
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const response = await agent
      .post(`${ROOT}/request`)
      .set('x-csrf-token', csrf)
      .send({ email: address })
      .expect(201);
    return { agent, csrf, response };
  }

  async function signIn(password: string, expected: number) {
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    return agent
      .post(`${AUTH_ROOT}/sign-in`)
      .set('x-csrf-token', csrf)
      .send({ email: 'person@example.test', password })
      .expect(expected);
  }

  it('returns the same non-enumerating response for known and unknown emails', async () => {
    await createRegisteredUser(app, suite, email);
    email.clear();
    const known = await requestReset('PERSON@EXAMPLE.TEST');
    const unknown = await requestReset('missing@example.test');

    expect(known.response.body).toEqual(unknown.response.body);
    expect(known.response.body).toEqual({
      message:
        'If an account exists for this email, a password reset email will be sent.',
    });
    expect(email.messages).toHaveLength(1);
    expect(email.messages[0]).toMatchObject({
      to: 'person@example.test',
      templateKey: 'password-reset',
      metadata: { userId: expect.any(String), tokenId: expect.any(String) },
    });
  });

  it('rejects invalid and expired reset codes and locks an over-attempted challenge', async () => {
    await createRegisteredUser(app, suite, email);
    email.clear();
    const pending = await requestReset();
    const tokenRepo = suite.dataSource.getRepository(AccountTokenEntity);
    const token = await tokenRepo.findOneOrFail({
      where: { type: AccountTokenType.PASSWORD_RESET },
    });
    const validCode = email.verificationCodeFor(token.id);
    const invalidCode = validCode === '000000' ? '999999' : '000000';

    for (
      let attempt = 0;
      attempt < MAX_VERIFICATION_CODE_ATTEMPTS;
      attempt += 1
    ) {
      await pending.agent
        .post(`${ROOT}/verify`)
        .set('x-csrf-token', pending.csrf)
        .send({ email: 'person@example.test', code: invalidCode })
        .expect(401);
    }
    const locked = await tokenRepo.findOneByOrFail({ id: token.id });
    expect(locked.failed_attempts).toBe(MAX_VERIFICATION_CODE_ATTEMPTS);
    expect(locked.locked_at).toBeInstanceOf(Date);
    await pending.agent
      .post(`${ROOT}/verify`)
      .set('x-csrf-token', pending.csrf)
      .send({ email: 'person@example.test', code: validCode })
      .expect(401);

    const next = await requestReset();
    const fresh = await tokenRepo.findOneOrFail({
      where: {
        type: AccountTokenType.PASSWORD_RESET,
        consumed_at: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
    await tokenRepo.update(fresh.id, {
      expires_at: new Date(Date.now() - 1_000),
    });
    await next.agent
      .post(`${ROOT}/verify`)
      .set('x-csrf-token', next.csrf)
      .send({
        email: 'person@example.test',
        code: email.verificationCodeFor(fresh.id),
      })
      .expect(401);
  });

  it('authorizes once, replaces the password, revokes sessions, and rejects replay', async () => {
    const user = await createRegisteredUser(app, suite, email);
    await signIn(OLD_PASSWORD, 201);
    await signIn(OLD_PASSWORD, 201);
    expect(
      await suite.dataSource
        .getRepository(UserSessionEntity)
        .countBy({ active: true }),
    ).toBe(2);
    email.clear();

    const pending = await requestReset();
    const token = await suite.dataSource
      .getRepository(AccountTokenEntity)
      .findOneOrFail({
        where: { user: { id: user.id }, type: AccountTokenType.PASSWORD_RESET },
      });
    const verified = await pending.agent
      .post(`${ROOT}/verify`)
      .set('x-csrf-token', pending.csrf)
      .send({
        email: 'person@example.test',
        code: email.verificationCodeFor(token.id),
      })
      .expect(200);
    expect(verified.body).toMatchObject({
      challenge_id: token.id,
      authorization: expect.any(String),
      expires_at: expect.any(String),
    });
    const body = {
      authorization: verified.body.authorization,
      password: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    };
    await pending.agent
      .patch(`${ROOT}/confirm?challenge_id=${token.id}`)
      .set('x-csrf-token', pending.csrf)
      .send(body)
      .expect(200, { message: 'Password reset successfully.' });
    await pending.agent
      .patch(`${ROOT}/confirm?challenge_id=${token.id}`)
      .set('x-csrf-token', pending.csrf)
      .send(body)
      .expect(401);

    const stored = await suite.dataSource
      .getRepository(AccountTokenEntity)
      .findOneByOrFail({ id: token.id });
    expect(stored).toMatchObject({
      consumed_at: expect.any(Date),
      metadata: { state: 'consumed' },
    });
    expect(
      (
        await suite.dataSource
          .getRepository(UserEntity)
          .findOneByOrFail({ id: user.id })
      ).metadata.last_changed_password,
    ).toBeTruthy();
    expect(
      await suite.dataSource
        .getRepository(UserSessionEntity)
        .countBy({ active: true }),
    ).toBe(0);
    expect(email.messages).toContainEqual(
      expect.objectContaining({
        to: 'person@example.test',
        templateKey: 'account-password-changed',
      }),
    );
    await signIn(OLD_PASSWORD, 401);
    await signIn(NEW_PASSWORD, 201);
  });
});
