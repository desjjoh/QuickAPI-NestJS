import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { jest } from '@jest/globals';
import request from 'supertest';

import { env } from '@/config/environment.config';
import {
  getCsrfCookieName,
  getRefreshCookieName,
} from '@/config/cookie.config';
import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { AccountStatusEntity } from '@/modules/domain/library/entities/accountstatus.entity';
import { TokenService } from '@/modules/system/tokens/services/token.service';
import {
  acquireCsrf,
  CapturingEmailService,
  REGISTRATION_ROOT,
  requestRegistration,
  setupAuthenticationSuite,
} from './authentication-e2e.helpers';
import { teardownTestSuite, type TestSuite } from '../../helpers/test-app';

const AUTH_ROOT = '/api/v1/authentication';
const SESSIONS_ROOT = '/api/v1/account/sessions';
const PASSWORD = 'Valid!Pass1';
const CSRF_COOKIE = getCsrfCookieName();
const REFRESH_COOKIE = getRefreshCookieName();

type Agent = ReturnType<typeof request.agent>;

function cookies(response: request.Response): string[] {
  const value = response.headers['set-cookie'];
  return typeof value === 'string' ? [value] : (value ?? []);
}

function cookieValue(response: request.Response, name: string): string {
  const cookie = cookies(response).find((value) =>
    value.startsWith(`${name}=`),
  );
  if (!cookie) throw new Error(`Response did not set ${name}.`);
  return cookie.slice(name.length + 1).split(';', 1)[0];
}

describe('Authentication and session lifecycle', () => {
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

  async function createUser(): Promise<UserEntity> {
    const pending = await requestRegistration(app, suite.dataSource);
    const challengeId = pending.response.body.challenge_id as string;
    await pending.agent
      .post(`${REGISTRATION_ROOT}/confirm`)
      .set('x-csrf-token', pending.csrf)
      .send({
        challenge_id: challengeId,
        code: email.verificationCodeFor(challengeId),
      })
      .expect(200);

    // Registration token issuance is covered separately. Start these tests with
    // no live sessions, so every row observed below belongs to an explicit sign-in.
    await suite.dataSource.getRepository(UserSessionEntity).clear();
    return suite.dataSource.getRepository(UserEntity).findOneOrFail({
      where: { identity: { email: 'person@example.test' } },
    });
  }

  async function signIn(agent: Agent, emailAddress = 'person@example.test') {
    const csrf = await acquireCsrf(agent);
    const response = await agent
      .post(`${AUTH_ROOT}/sign-in`)
      .set('x-csrf-token', csrf)
      .set('user-agent', 'QuickAPI E2E Browser/1.0')
      .send({ email: emailAddress, password: PASSWORD })
      .expect(201);
    return { csrf, response, access: response.body.access_token as string };
  }

  it('signs in with normalized credentials and protects account endpoints with the issued access token', async () => {
    const user = await createUser();
    const agent = request.agent(app.getHttpServer());
    const signedIn = await signIn(agent, 'PERSON@EXAMPLE.TEST');

    expect(signedIn.response.body).toMatchObject({
      access_token: expect.any(String),
      user: expect.objectContaining({
        identity: expect.objectContaining({ email: 'person@example.test' }),
      }),
    });
    const refreshCookie = cookies(signedIn.response).find((value) =>
      value.startsWith(`${REFRESH_COOKIE}=`),
    );
    expect(refreshCookie).toEqual(expect.stringContaining('HttpOnly'));
    expect(refreshCookie).toEqual(expect.stringContaining('Path=/'));
    expect(refreshCookie).toEqual(
      expect.stringMatching(/SameSite=(Lax|Strict|None)/),
    );
    expect(refreshCookie).toEqual(expect.stringMatching(/Max-Age=\d+/));
    expect(refreshCookie).not.toEqual(expect.stringContaining('Secure'));

    const sessions = await agent
      .get(SESSIONS_ROOT)
      .set('authorization', `Bearer ${signedIn.access}`)
      .set('x-csrf-token', signedIn.csrf)
      .expect(200);
    expect(sessions.body).toEqual([
      expect.objectContaining({ id: signedIn.response.body.user.session.id }),
    ]);
    const row = await suite.dataSource
      .getRepository(UserSessionEntity)
      .findOneByOrFail({
        id: signedIn.response.body.user.session.id as string,
      });
    expect(row).toMatchObject({
      active: true,
      user_agent: 'QuickAPI E2E Browser/1.0',
    });
    expect(row.refresh).toMatch(/^[a-f0-9]{64}$/);
    expect(
      await suite.dataSource.getRepository(UserSessionEntity).countBy({
        id: row.id,
        user: { id: user.id },
      }),
    ).toBe(1);
  });

  it.each([
    ['wrong password', 'person@example.test', 'Wrong!Pass1', 401],
    ['unknown user', 'unknown@example.test', PASSWORD, 401],
  ])(
    'rejects %s without creating a session',
    async (_case, address, password, status) => {
      await createUser();
      const agent = request.agent(app.getHttpServer());
      const csrf = await acquireCsrf(agent);
      await agent
        .post(`${AUTH_ROOT}/sign-in`)
        .set('x-csrf-token', csrf)
        .send({ email: address, password })
        .expect(status);
      expect(
        await suite.dataSource.getRepository(UserSessionEntity).count(),
      ).toBe(0);
    },
  );

  it('rejects an inactive account without creating a session', async () => {
    const user = await createUser();
    const inactive = await suite.dataSource
      .getRepository(AccountStatusEntity)
      .findOneOrFail({ where: { key: ACCOUNT_STATUS_KEYS.DISABLED } });
    await suite.dataSource
      .createQueryBuilder()
      .relation(UserEntity, 'status')
      .of(user.id)
      .set(inactive.id);
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    await agent
      .post(`${AUTH_ROOT}/sign-in`)
      .set('x-csrf-token', csrf)
      .send({ email: 'person@example.test', password: PASSWORD })
      .expect(403);
    expect(
      await suite.dataSource.getRepository(UserSessionEntity).count(),
    ).toBe(0);
  });

  it('refreshes through HttpOnly cookie + CSRF, rotates it, and rejects the previous token', async () => {
    await createUser();
    const agent = request.agent(app.getHttpServer());
    const signedIn = await signIn(agent);
    const oldRefresh = cookieValue(signedIn.response, REFRESH_COOKIE);
    const sessionId = signedIn.response.body.user.session.id as string;

    const refreshed = await agent
      .post(`${AUTH_ROOT}/refresh`)
      .set('x-csrf-token', signedIn.csrf)
      .send({})
      .expect(201);
    const newRefresh = cookieValue(refreshed, REFRESH_COOKIE);
    expect(newRefresh).not.toBe(oldRefresh);
    expect(cookies(refreshed).join(';')).toContain('HttpOnly');
    const row = await suite.dataSource
      .getRepository(UserSessionEntity)
      .findOneByOrFail({ id: sessionId });
    expect(row.token_version).toBe(2);
    expect(row.refresh).toBe(suite.app.get(TokenService).hashToken(newRefresh));

    const csrfResponse = await request(app.getHttpServer())
      .get('/api/v1/security/csrf')
      .expect(200);
    await request(app.getHttpServer())
      .post(`${AUTH_ROOT}/refresh`)
      .set('x-csrf-token', csrfResponse.body.token as string)
      .set(
        'cookie',
        `${CSRF_COOKIE}=${cookieValue(csrfResponse, CSRF_COOKIE)}; ${REFRESH_COOKIE}=${oldRefresh}`,
      )
      .send({})
      .expect(401);
  });

  it('signs out, clears the cookie, persists revocation, and rejects the revoked session', async () => {
    await createUser();
    const agent = request.agent(app.getHttpServer());
    const signedIn = await signIn(agent);
    const refresh = cookieValue(signedIn.response, REFRESH_COOKIE);
    const sessionId = signedIn.response.body.user.session.id as string;
    const response = await agent
      .post(`${AUTH_ROOT}/sign-out`)
      .set('x-csrf-token', signedIn.csrf)
      .send({})
      .expect(201);
    expect(
      cookies(response).find((value) => value.startsWith(`${REFRESH_COOKIE}=`)),
    ).toEqual(
      expect.stringMatching(
        new RegExp(
          `${REFRESH_COOKIE}=;.*(?:Max-Age=0|Expires=Thu, 01 Jan 1970)`,
        ),
      ),
    );
    expect(
      await suite.dataSource
        .getRepository(UserSessionEntity)
        .findOneByOrFail({ id: sessionId }),
    ).toMatchObject({ active: false, refresh: null });
    const attackerCsrf = await request(app.getHttpServer())
      .get('/api/v1/security/csrf')
      .expect(200);
    await request(app.getHttpServer())
      .post(`${AUTH_ROOT}/refresh`)
      .set('x-csrf-token', attackerCsrf.body.token as string)
      .set(
        'cookie',
        `${CSRF_COOKIE}=${cookieValue(attackerCsrf, CSRF_COOKIE)}; ${REFRESH_COOKIE}=${refresh}`,
      )
      .send({})
      .expect(401);
  });

  it('lists sessions and revokes one other session without revoking the current session', async () => {
    await createUser();
    const first = await signIn(request.agent(app.getHttpServer()));
    const secondAgent = request.agent(app.getHttpServer());
    const second = await signIn(secondAgent);
    const firstId = first.response.body.user.session.id as string;
    const secondId = second.response.body.user.session.id as string;
    const listed = await secondAgent
      .get(SESSIONS_ROOT)
      .set('authorization', `Bearer ${second.access}`)
      .set('x-csrf-token', second.csrf)
      .expect(200);
    expect(listed.body.map((item: { id: string }) => item.id).sort()).toEqual(
      [firstId, secondId].sort(),
    );
    const revoked = await secondAgent
      .delete(`${SESSIONS_ROOT}/${firstId}`)
      .set('authorization', `Bearer ${second.access}`)
      .set('x-csrf-token', second.csrf)
      .expect(200);
    expect(
      cookies(revoked).some((value) => value.startsWith(`${REFRESH_COOKIE}=;`)),
    ).toBe(false);
    expect(
      await suite.dataSource
        .getRepository(UserSessionEntity)
        .findOneByOrFail({ id: firstId }),
    ).toMatchObject({ active: false, refresh: null });
    expect(
      await suite.dataSource
        .getRepository(UserSessionEntity)
        .findOneByOrFail({ id: secondId }),
    ).toMatchObject({ active: true });
  });

  it('revokes all sessions including the current session and clears its cookie', async () => {
    await createUser();
    await signIn(request.agent(app.getHttpServer()));
    const currentAgent = request.agent(app.getHttpServer());
    const current = await signIn(currentAgent);
    const response = await currentAgent
      .delete(SESSIONS_ROOT)
      .set('authorization', `Bearer ${current.access}`)
      .set('x-csrf-token', current.csrf)
      .expect(200);
    expect(
      cookies(response).find((value) => value.startsWith(`${REFRESH_COOKIE}=`)),
    ).toEqual(
      expect.stringMatching(
        new RegExp(
          `${REFRESH_COOKIE}=;.*(?:Max-Age=0|Expires=Thu, 01 Jan 1970)`,
        ),
      ),
    );
    const rows = await suite.dataSource.getRepository(UserSessionEntity).find();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => !row.active && row.refresh === null)).toBe(true);
    await currentAgent
      .post(`${AUTH_ROOT}/refresh`)
      .set('x-csrf-token', current.csrf)
      .send({})
      .expect(401);
  });

  it('rejects missing, malformed, expired, and cryptographically invalid access tokens', async () => {
    const user = await createUser();
    const agent = request.agent(app.getHttpServer());
    const signedIn = await signIn(agent);
    const session = signedIn.response.body.user.session;
    const jwt = app.get(JwtService);
    const expired = await jwt.signAsync(
      { sub: user.id, email: user.identity.email, sid: session.id, version: 1 },
      { secret: env.JWT_SECRET_KEY, expiresIn: -1 },
    );
    const invalid = await jwt.signAsync(
      { sub: user.id, email: user.identity.email, sid: session.id, version: 1 },
      { secret: `${env.JWT_SECRET_KEY}-invalid`, expiresIn: '5m' },
    );
    for (const token of [undefined, 'not-a-jwt', expired, invalid]) {
      const call = agent.get(SESSIONS_ROOT).set('x-csrf-token', signedIn.csrf);
      if (token) call.set('authorization', `Bearer ${token}`);
      await call.expect(401);
    }
  });

  it('rejects missing, malformed, expired, and cryptographically invalid refresh cookies', async () => {
    const user = await createUser();
    const signedIn = await signIn(request.agent(app.getHttpServer()));
    const session = signedIn.response.body.user.session;
    const jwt = app.get(JwtService);
    const candidates = [
      undefined,
      'not-a-jwt',
      await jwt.signAsync(
        {
          sub: user.id,
          email: user.identity.email,
          sid: session.id,
          version: 1,
        },
        { secret: env.REFRESH_SECRET_KEY, expiresIn: -1 },
      ),
      await jwt.signAsync(
        {
          sub: user.id,
          email: user.identity.email,
          sid: session.id,
          version: 1,
        },
        { secret: `${env.REFRESH_SECRET_KEY}-invalid`, expiresIn: '5m' },
      ),
    ];
    for (const candidate of candidates) {
      const csrf = await request(app.getHttpServer())
        .get('/api/v1/security/csrf')
        .expect(200);
      const cookie = `${CSRF_COOKIE}=${cookieValue(csrf, CSRF_COOKIE)}${
        candidate ? `; ${REFRESH_COOKIE}=${candidate}` : ''
      }`;
      await request(app.getHttpServer())
        .post(`${AUTH_ROOT}/refresh`)
        .set('x-csrf-token', csrf.body.token as string)
        .set('cookie', cookie)
        .send({})
        .expect(401);
    }
  });
});
