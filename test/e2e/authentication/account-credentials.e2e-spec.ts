import type { INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import request from 'supertest';

import { AccountTokenType } from '@/config/token.config';
import { AccountTokenEntity } from '@/modules/domain/identity/entities/account-token.entity';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import {
  acquireCsrf,
  CapturingEmailService,
  createRegisteredUser,
  registrationPayload,
  REGISTRATION_ROOT,
  setupAuthenticationSuite,
} from './authentication-e2e.helpers';
import { teardownTestSuite, type TestSuite } from '../../helpers/test-app';

const ACCOUNT_ROOT = '/api/v1/account';
const VERIFY_ROOT = '/api/v1/authentication/email-verification';
const AUTH_ROOT = '/api/v1/authentication';
const PASSWORD = 'Valid!Pass1';
describe('Authenticated credential and email changes', () => {
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

  async function signIn(
    address = 'person@example.test',
    password = PASSWORD,
    expectedStatus = 201,
  ) {
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const response = await agent
      .post(`${AUTH_ROOT}/sign-in`)
      .set('x-csrf-token', csrf)
      .send({ email: address, password })
      .expect(expectedStatus);
    return {
      agent,
      csrf,
      access: response.body.access_token as string,
      response,
    };
  }

  async function register(address: string): Promise<UserEntity> {
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const response = await agent
      .post(`${REGISTRATION_ROOT}/request`)
      .set('x-csrf-token', csrf)
      .send({
        ...(await registrationPayload(suite.dataSource)),
        email: address,
      })
      .expect(201);
    const id = response.body.challenge_id as string;
    await agent
      .post(`${REGISTRATION_ROOT}/confirm`)
      .set('x-csrf-token', csrf)
      .send({ challenge_id: id, code: email.verificationCodeFor(id) })
      .expect(200);
    return suite.dataSource.getRepository(UserEntity).findOneOrFail({
      where: { identity: { email: address.toLowerCase() } },
    });
  }

  function authPatch(
    session: Awaited<ReturnType<typeof signIn>>,
    path: string,
  ) {
    return session.agent
      .patch(path)
      .set('authorization', `Bearer ${session.access}`)
      .set('x-csrf-token', session.csrf);
  }

  function authPost(session: Awaited<ReturnType<typeof signIn>>, path: string) {
    return session.agent
      .post(path)
      .set('authorization', `Bearer ${session.access}`)
      .set('x-csrf-token', session.csrf);
  }

  it('changes a password only with the correct current password and preserves only the current session', async () => {
    const user = await createRegisteredUser(app, suite, email);
    const other = await signIn();
    const current = await signIn();
    email.clear();
    const payload = {
      password: 'Wrong!Pass1',
      new_password: 'Other!Pass2',
      confirm: 'Other!Pass2',
    };
    await authPatch(current, `${ACCOUNT_ROOT}/password`)
      .send(payload)
      .expect(401);
    expect(
      (
        await suite.dataSource
          .getRepository(UserEntity)
          .findOneByOrFail({ id: user.id })
      ).metadata.last_changed_password,
    ).toBeNull();

    const changed = await authPatch(current, `${ACCOUNT_ROOT}/password`)
      .send({
        password: PASSWORD,
        new_password: 'Other!Pass2',
        confirm: 'Other!Pass2',
      })
      .expect(200);
    expect(changed.body.access_token).toEqual(expect.any(String));
    const rows = await suite.dataSource
      .getRepository(UserSessionEntity)
      .find({ where: { user: { id: user.id } } });
    expect(
      rows.find((row) => row.id === other.response.body.user.session.id)
        ?.active,
    ).toBe(false);
    expect(
      rows.find((row) => row.id === current.response.body.user.session.id)
        ?.active,
    ).toBe(true);
    expect(email.messages).toContainEqual(
      expect.objectContaining({ templateKey: 'account-password-changed' }),
    );

    await signIn('person@example.test', PASSWORD, 401);
    await signIn('person@example.test', 'Other!Pass2');
  });

  it('changes to an available normalized email and notifies both the new and old addresses', async () => {
    const user = await createRegisteredUser(app, suite, email);
    const session = await signIn();
    email.clear();
    const challenge = await authPost(session, `${ACCOUNT_ROOT}/email`)
      .send({ email: 'New.Address@Example.Test', password: PASSWORD })
      .expect(201);
    const id = challenge.body.challenge_id as string;
    expect(email.messages).toContainEqual(
      expect.objectContaining({
        to: 'new.address@example.test',
        templateKey: 'email-verification',
      }),
    );
    const confirmed = await authPatch(session, `${VERIFY_ROOT}/confirm`)
      .send({
        challenge_id: id,
        code: email.verificationCodeFor(id),
      })
      .expect(200);
    expect(confirmed.body.user.identity.email).toBe('new.address@example.test');

    const stored = await suite.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: user.id });
    expect(stored.identity.email).toBe('new.address@example.test');
    expect(stored.metadata.last_changed_email).toBeTruthy();
    expect(
      (
        await suite.dataSource
          .getRepository(AccountTokenEntity)
          .findOneByOrFail({ id })
      ).consumed_at,
    ).toBeInstanceOf(Date);
    expect(email.messages).toContainEqual(
      expect.objectContaining({
        to: 'person@example.test',
        templateKey: 'email-changed',
        model: expect.objectContaining({ email: 'new.address@example.test' }),
      }),
    );
  });

  it('rejects an email collision without creating a verification challenge', async () => {
    await createRegisteredUser(app, suite, email);
    await register('taken@example.test');
    const session = await signIn();
    email.clear();
    const before = await suite.dataSource
      .getRepository(AccountTokenEntity)
      .countBy({ type: AccountTokenType.EMAIL_VERIFICATION });
    await authPost(session, `${ACCOUNT_ROOT}/email`)
      .send({ email: 'TAKEN@EXAMPLE.TEST', password: PASSWORD })
      .expect(409);
    expect(
      await suite.dataSource
        .getRepository(AccountTokenEntity)
        .countBy({ type: AccountTokenType.EMAIL_VERIFICATION }),
    ).toBe(before);
    expect(email.messages).toHaveLength(0);
  });

  it('rejects replay and cross-user use of an email verification challenge', async () => {
    const owner = await createRegisteredUser(app, suite, email);
    const attacker = await register('attacker@example.test');
    await suite.dataSource.getRepository(UserSessionEntity).clear();
    const ownerSession = await signIn();
    const attackerSession = await signIn('attacker@example.test');
    const challenge = await authPost(ownerSession, `${ACCOUNT_ROOT}/email`)
      .send({ email: 'owner.new@example.test', password: PASSWORD })
      .expect(201);
    const id = challenge.body.challenge_id as string;
    const body = { challenge_id: id, code: email.verificationCodeFor(id) };

    await authPatch(attackerSession, `${VERIFY_ROOT}/confirm`)
      .send(body)
      .expect(401);
    expect(
      (
        await suite.dataSource
          .getRepository(UserEntity)
          .findOneByOrFail({ id: attacker.id })
      ).identity.email,
    ).toBe('attacker@example.test');
    await authPatch(ownerSession, `${VERIFY_ROOT}/confirm`)
      .send(body)
      .expect(200);
    await authPatch(ownerSession, `${VERIFY_ROOT}/confirm`)
      .send(body)
      .expect(401);
    expect(
      (
        await suite.dataSource
          .getRepository(UserEntity)
          .findOneByOrFail({ id: owner.id })
      ).identity.email,
    ).toBe('owner.new@example.test');
    expect(
      (
        await suite.dataSource
          .getRepository(AccountTokenEntity)
          .findOneByOrFail({ id })
      ).consumed_at,
    ).toBeInstanceOf(Date);
  });
});
