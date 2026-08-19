import type { INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import request from 'supertest';

import { MAX_VERIFICATION_CODE_ATTEMPTS } from '@/config/token.config';
import { AccountTokenEntity } from '@/modules/domain/identity/entities/account-token.entity';
import {
  MfaChallengePurpose,
  MfaMethod,
  UserMfaSettingsEntity,
} from '@/modules/domain/identity/entities/mfa.entity';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { AuditEventEntity } from '@/modules/domain/audit/entities/audit-event.entity';
import {
  AUDIT_EVENT_MATRIX,
  AuditEventDomain,
} from '@/config/audit-events.config';
import { teardownTestSuite, type TestSuite } from '../../helpers/test-app';
import {
  acquireCsrf,
  CapturingEmailService,
  createRegisteredUser,
  setupAuthenticationSuite,
} from './authentication-e2e.helpers';

const AUTH_ROOT = '/api/v1/authentication';
const MFA_ROOT = '/api/v1/account/mfa';
const PASSWORD = 'Valid!Pass1';

type Agent = ReturnType<typeof request.agent>;

function setCookies(response: request.Response): string[] {
  const value = response.headers['set-cookie'];
  return typeof value === 'string' ? [value] : (value ?? []);
}

describe('Email MFA lifecycle', () => {
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

  async function ordinarySignIn(emailAddress = 'person@example.test') {
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const response = await agent
      .post(`${AUTH_ROOT}/sign-in`)
      .set('x-csrf-token', csrf)
      .send({ email: emailAddress, password: PASSWORD })
      .expect(201);
    return {
      agent,
      csrf,
      access: response.body.access_token as string,
      response,
    };
  }

  async function requestEnrollment(agent: Agent, csrf: string, access: string) {
    const response = await agent
      .patch(MFA_ROOT)
      .set('authorization', `Bearer ${access}`)
      .set('x-csrf-token', csrf)
      .send({ enabled: true, password: PASSWORD })
      .expect(200);
    return {
      response,
      challengeId: response.body.challenge_id as string,
    };
  }

  async function enableMfa() {
    const user = await createRegisteredUser(app, suite, email);
    email.clear();
    const authenticated = await ordinarySignIn();
    const enrollment = await requestEnrollment(
      authenticated.agent,
      authenticated.csrf,
      authenticated.access,
    );
    await authenticated.agent
      .post(`${MFA_ROOT}/confirm`)
      .set('authorization', `Bearer ${authenticated.access}`)
      .set('x-csrf-token', authenticated.csrf)
      .send({
        challenge_id: enrollment.challengeId,
        code: email.verificationCodeFor(enrollment.challengeId),
      })
      .expect(201);
    return { user, authenticated };
  }

  it('requests and verifies enrollment, stores purpose and only a code hash, and rejects repeat enrollment', async () => {
    const user = await createRegisteredUser(app, suite, email);
    email.clear();
    const authenticated = await ordinarySignIn();
    const enrollment = await requestEnrollment(
      authenticated.agent,
      authenticated.csrf,
      authenticated.access,
    );
    const code = email.verificationCodeFor(enrollment.challengeId);

    expect(enrollment.response.body).toMatchObject({
      mfa_required: true,
      challenge_id: enrollment.challengeId,
      method: MfaMethod.EMAIL_OTP,
      expires_at: expect.any(String),
    });
    expect(email.messages).toContainEqual(
      expect.objectContaining({
        to: 'person@example.test',
        templateKey: 'mfa-enrollment-code',
        metadata: expect.objectContaining({
          challengeId: enrollment.challengeId,
          purpose: MfaChallengePurpose.ENABLE,
          userId: user.id,
        }),
      }),
    );
    const challenge = await suite.dataSource
      .getRepository(AccountTokenEntity)
      .findOneByOrFail({ id: enrollment.challengeId });
    expect(challenge.metadata).toEqual({ purpose: MfaChallengePurpose.ENABLE });
    expect(challenge.mfa_code_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(challenge.mfa_code_hash).not.toBe(code);
    expect(JSON.stringify(challenge)).not.toContain(code);

    await authenticated.agent
      .post(`${MFA_ROOT}/confirm`)
      .set('authorization', `Bearer ${authenticated.access}`)
      .set('x-csrf-token', authenticated.csrf)
      .send({ challenge_id: enrollment.challengeId, code })
      .expect(201);
    expect(
      await suite.dataSource
        .getRepository(UserMfaSettingsEntity)
        .findOneByOrFail({ user: { id: user.id } }),
    ).toMatchObject({
      enabled: true,
      primary_method: MfaMethod.EMAIL_OTP,
      enabled_at: expect.any(Date),
      last_verified_at: expect.any(Date),
    });

    await authenticated.agent
      .patch(MFA_ROOT)
      .set('authorization', `Bearer ${authenticated.access}`)
      .set('x-csrf-token', authenticated.csrf)
      .send({ enabled: true, password: PASSWORD })
      .expect(400);
  });

  it('withholds tokens until a correct sign-in challenge is completed and rejects replay', async () => {
    await enableMfa();
    await suite.dataSource.getRepository(UserSessionEntity).clear();
    email.clear();
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const pending = await agent
      .post(`${AUTH_ROOT}/sign-in`)
      .set('x-csrf-token', csrf)
      .send({ email: 'person@example.test', password: PASSWORD })
      .expect(202);
    const challengeId = pending.body.challenge_id as string;

    expect(pending.body).toMatchObject({
      mfa_required: true,
      challenge_id: challengeId,
      method: MfaMethod.EMAIL_OTP,
    });
    expect(pending.body).not.toHaveProperty('access_token');
    expect(pending.body).not.toHaveProperty('refresh');
    expect(setCookies(pending).some((cookie) => /refresh/i.test(cookie))).toBe(
      false,
    );
    expect(
      await suite.dataSource.getRepository(UserSessionEntity).count(),
    ).toBe(0);
    const challenge = await suite.dataSource
      .getRepository(AccountTokenEntity)
      .findOneByOrFail({ id: challengeId });
    expect(challenge.metadata).toEqual({
      purpose: MfaChallengePurpose.SIGN_IN,
    });
    const code = email.verificationCodeFor(challengeId);
    expect(challenge.mfa_code_hash).not.toBe(code);

    const completed = await agent
      .post(`${AUTH_ROOT}/sign-in/mfa/verify`)
      .set('x-csrf-token', csrf)
      .send({ challenge_id: challengeId, code })
      .expect(200);
    expect(completed.body).toMatchObject({
      access_token: expect.any(String),
      refresh: expect.any(Number),
      user: expect.any(Object),
    });
    const issuedSessionId = completed.body.user.session.id as string;
    await expect(
      suite.dataSource.getRepository(AuditEventEntity).findOneByOrFail({
        event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].SIGN_IN_SUCCEEDED,
        subject_id: completed.body.user.id as string,
        session_id: issuedSessionId,
      }),
    ).resolves.toMatchObject({
      session_id: issuedSessionId,
      route: `${AUTH_ROOT}/sign-in/mfa/verify`,
    });
    expect(
      await suite.dataSource.getRepository(UserSessionEntity).count(),
    ).toBe(1);
    await agent
      .post(`${AUTH_ROOT}/sign-in/mfa/verify`)
      .set('x-csrf-token', csrf)
      .send({ challenge_id: challengeId, code })
      .expect(401);
  });

  it('rejects incorrect and expired sign-in codes without issuing sessions', async () => {
    await enableMfa();
    await suite.dataSource.getRepository(UserSessionEntity).clear();
    email.clear();
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const first = await agent
      .post(`${AUTH_ROOT}/sign-in`)
      .set('x-csrf-token', csrf)
      .send({ email: 'person@example.test', password: PASSWORD })
      .expect(202);
    const firstId = first.body.challenge_id as string;
    const correct = email.verificationCodeFor(firstId);
    const incorrect = correct === '000000' ? '999999' : '000000';
    await agent
      .post(`${AUTH_ROOT}/sign-in/mfa/verify`)
      .set('x-csrf-token', csrf)
      .send({ challenge_id: firstId, code: incorrect })
      .expect(401);

    const second = await agent
      .post(`${AUTH_ROOT}/sign-in`)
      .set('x-csrf-token', csrf)
      .send({ email: 'person@example.test', password: PASSWORD })
      .expect(202);
    const secondId = second.body.challenge_id as string;
    await suite.dataSource
      .getRepository(AccountTokenEntity)
      .update(secondId, { expires_at: new Date(Date.now() - 1_000) });
    await agent
      .post(`${AUTH_ROOT}/sign-in/mfa/verify`)
      .set('x-csrf-token', csrf)
      .send({
        challenge_id: secondId,
        code: email.verificationCodeFor(secondId),
      })
      .expect(401);
    expect(
      await suite.dataSource.getRepository(UserSessionEntity).count(),
    ).toBe(0);
  });

  it('locks a sign-in challenge after exhausting verification attempts', async () => {
    await enableMfa();
    await suite.dataSource.getRepository(UserSessionEntity).clear();
    email.clear();
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const pending = await agent
      .post(`${AUTH_ROOT}/sign-in`)
      .set('x-csrf-token', csrf)
      .send({ email: 'person@example.test', password: PASSWORD })
      .expect(202);
    const challengeId = pending.body.challenge_id as string;
    const correct = email.verificationCodeFor(challengeId);
    const incorrect = correct === '000000' ? '999999' : '000000';

    for (
      let attempt = 0;
      attempt < MAX_VERIFICATION_CODE_ATTEMPTS;
      attempt += 1
    )
      await agent
        .post(`${AUTH_ROOT}/sign-in/mfa/verify`)
        .set('x-csrf-token', csrf)
        .send({ challenge_id: challengeId, code: incorrect })
        .expect(401);

    const challenge = await suite.dataSource
      .getRepository(AccountTokenEntity)
      .findOneByOrFail({ id: challengeId });
    expect(challenge.failed_attempts).toBe(MAX_VERIFICATION_CODE_ATTEMPTS);
    expect(challenge.locked_at).toBeInstanceOf(Date);
    await agent
      .post(`${AUTH_ROOT}/sign-in/mfa/verify`)
      .set('x-csrf-token', csrf)
      .send({ challenge_id: challengeId, code: correct })
      .expect(401);
    expect(
      await suite.dataSource.getRepository(UserSessionEntity).count(),
    ).toBe(0);
  });

  it('rejects challenges used for the wrong MFA purpose', async () => {
    await createRegisteredUser(app, suite, email);
    email.clear();
    const authenticated = await ordinarySignIn();
    const enrollment = await requestEnrollment(
      authenticated.agent,
      authenticated.csrf,
      authenticated.access,
    );
    await authenticated.agent
      .post(`${AUTH_ROOT}/sign-in/mfa/verify`)
      .set('x-csrf-token', authenticated.csrf)
      .send({
        challenge_id: enrollment.challengeId,
        code: email.verificationCodeFor(enrollment.challengeId),
      })
      .expect(401);

    await authenticated.agent
      .post(`${MFA_ROOT}/confirm`)
      .set('authorization', `Bearer ${authenticated.access}`)
      .set('x-csrf-token', authenticated.csrf)
      .send({
        challenge_id: enrollment.challengeId,
        code: email.verificationCodeFor(enrollment.challengeId),
      })
      .expect(201);
    email.clear();
    const pending = await authenticated.agent
      .post(`${AUTH_ROOT}/sign-in`)
      .set('x-csrf-token', authenticated.csrf)
      .send({ email: 'person@example.test', password: PASSWORD })
      .expect(202);
    const signInId = pending.body.challenge_id as string;
    await authenticated.agent
      .post(`${MFA_ROOT}/confirm`)
      .set('authorization', `Bearer ${authenticated.access}`)
      .set('x-csrf-token', authenticated.csrf)
      .send({
        challenge_id: signInId,
        code: email.verificationCodeFor(signInId),
      })
      .expect(401);
  });

  it("prevents one authenticated user from confirming another user's enrollment challenge", async () => {
    const owner = await createRegisteredUser(app, suite, email);
    await suite.dataSource
      .getRepository(UserEntity)
      .update(owner.id, { identity: { email: 'owner@example.test' } });
    email.clear();
    const ownerAuth = await ordinarySignIn('owner@example.test');
    const enrollment = await requestEnrollment(
      ownerAuth.agent,
      ownerAuth.csrf,
      ownerAuth.access,
    );
    const ownerCode = email.verificationCodeFor(enrollment.challengeId);

    await createRegisteredUser(app, suite, email);
    const otherAuth = await ordinarySignIn();
    await otherAuth.agent
      .post(`${MFA_ROOT}/confirm`)
      .set('authorization', `Bearer ${otherAuth.access}`)
      .set('x-csrf-token', otherAuth.csrf)
      .send({ challenge_id: enrollment.challengeId, code: ownerCode })
      .expect(401);
    expect(
      await suite.dataSource
        .getRepository(UserMfaSettingsEntity)
        .countBy({ user: { id: owner.id }, enabled: true }),
    ).toBe(0);
  });

  it('disables MFA, rejects repeat disabling, and permits ordinary sign-in afterward', async () => {
    const { user, authenticated } = await enableMfa();
    await authenticated.agent
      .patch(MFA_ROOT)
      .set('authorization', `Bearer ${authenticated.access}`)
      .set('x-csrf-token', authenticated.csrf)
      .send({ enabled: false, password: PASSWORD })
      .expect(200);
    expect(
      await suite.dataSource
        .getRepository(UserMfaSettingsEntity)
        .findOneByOrFail({ user: { id: user.id } }),
    ).toMatchObject({ enabled: false, disabled_at: expect.any(Date) });

    await authenticated.agent
      .patch(MFA_ROOT)
      .set('authorization', `Bearer ${authenticated.access}`)
      .set('x-csrf-token', authenticated.csrf)
      .send({ enabled: false, password: PASSWORD })
      .expect(400);
    await suite.dataSource.getRepository(UserSessionEntity).clear();
    const signedIn = await ordinarySignIn();
    expect(signedIn.response.body).toMatchObject({
      access_token: expect.any(String),
      refresh: expect.any(Number),
    });
    expect(signedIn.response.body).not.toHaveProperty('mfa_required');
  });
});
