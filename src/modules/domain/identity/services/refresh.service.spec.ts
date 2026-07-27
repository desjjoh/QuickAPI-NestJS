jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));
jest.mock('../models/jwt.model', () => ({
  JWTDto: class {
    public constructor(values: Record<string, unknown>) {
      Object.assign(this, values);
    }
  },
}));

import { NotFoundException } from '@nestjs/common';

import {
  getRefreshCookieName,
  getRefreshCookieOptions,
} from '@/config/cookie.config';
import { UserSessionEntity } from '../entities/session.entity';
import { RefreshService } from './refresh.service';

describe('RefreshService', () => {
  const user = { id: 'u1', identity: { email: 'user@test.dev' } };
  const session = {
    id: 's1',
    user,
    token_version: 0,
    active: true,
    refresh: null,
  };
  const tokenSvc = {
    createTokenPair: jest.fn(),
    hashToken: jest.fn(),
    decode: jest.fn(),
  };
  const manager = {
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const userRepo = { manager, revokeAllSessions: jest.fn() };
  const requestContext = { get: jest.fn() };
  const ipLocation = { resolve: jest.fn() };
  const res = { cookie: jest.fn(), clearCookie: jest.fn() };
  let service: RefreshService;

  const expectIssuedFromSession = (sessionId: string, version: number) => {
    expect(manager.save).toHaveBeenNthCalledWith(
      manager.save.mock.calls.length - 1,
      UserSessionEntity,
      expect.objectContaining({
        id: sessionId,
        token_version: version,
      }),
    );
    expect(tokenSvc.createTokenPair).toHaveBeenCalledWith({
      sub: 'u1',
      email: 'user@test.dev',
      version,
      sid: sessionId,
    });
    expect(tokenSvc.hashToken).toHaveBeenCalledWith('refresh-plain');
    expect(manager.save).toHaveBeenLastCalledWith(
      UserSessionEntity,
      expect.objectContaining({
        id: sessionId,
        token_version: version,
        refresh: 'refresh-hash',
      }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      getRefreshCookieName(),
      'refresh-plain',
      getRefreshCookieOptions(),
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    requestContext.get.mockReturnValue(undefined);
    manager.create.mockImplementation((_type, value) => value);
    manager.save.mockImplementation(async (_type, value) => ({
      id: value.id ?? 'new-session',
      ...value,
    }));
    tokenSvc.createTokenPair.mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh-plain',
    });
    tokenSvc.hashToken.mockReturnValue('refresh-hash');
    tokenSvc.decode.mockImplementation((token) =>
      token === 'access' ? { iat: 1, exp: 2 } : { exp: 3 },
    );
    service = new RefreshService(
      tokenSvc as never,
      userRepo as never,
      requestContext as never,
      ipLocation as never,
    );
  });

  it('rotates an explicitly supplied session in preference to the request session', async () => {
    const suppliedSession = { ...session, id: 'supplied', token_version: 4 };
    requestContext.get.mockReturnValue({
      user: { sessionEntity: { ...session, id: 'context' } },
    });

    const result = await service.issueTokens(
      user as never,
      res as never,
      suppliedSession as never,
    );

    expect(manager.create).not.toHaveBeenCalled();
    expectIssuedFromSession('supplied', 5);
    expect(result).toEqual(
      expect.objectContaining({
        access_token: 'access',
        iat: 1,
        exp: 2,
        refresh: 3,
        session: expect.objectContaining({
          id: 'supplied',
          token_version: 5,
          refresh: 'refresh-hash',
        }),
      }),
    );
  });

  it('rotates the session obtained from RequestContext', async () => {
    requestContext.get.mockReturnValue({ user: { sessionEntity: session } });

    await service.issueTokens(user as never, res as never);

    expect(manager.create).not.toHaveBeenCalled();
    expectIssuedFromSession('s1', 1);
  });

  it('creates a session when neither an explicit nor contextual session exists', async () => {
    const result = await service.issueTokens(user as never, res as never);

    expect(manager.create).toHaveBeenCalledWith(UserSessionEntity, {
      user,
      token_version: 0,
      active: true,
      refresh: null,
    });
    expect(ipLocation.resolve).not.toHaveBeenCalled();
    expectIssuedFromSession('new-session', 1);
    expect(result.access_token).toBe('access');
  });

  it('creates a session without request metadata or a location lookup when the request is missing', async () => {
    await service.issueTokens(user as never, res as never);

    expect(requestContext.get).toHaveBeenCalledWith('request');
    expect(ipLocation.resolve).not.toHaveBeenCalled();
    expect(manager.create).toHaveBeenCalledWith(UserSessionEntity, {
      user,
      refresh: null,
      token_version: 0,
      active: true,
    });
  });

  it('persists request session information with null location fields when geolocation is unresolved', async () => {
    const req = {
      ip: '203.0.113.10',
      socket: {},
      get: jest.fn(
        (header: string) =>
          ({
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0',
            'accept-language': 'en-CA,en;q=0.9',
            origin: 'https://app.test.dev',
          })[header],
      ),
    };
    requestContext.get.mockReturnValue(req);
    ipLocation.resolve.mockResolvedValue(null);

    await service.issueTokens(user as never, res as never);

    expect(ipLocation.resolve).toHaveBeenCalledWith(req);
    expect(manager.create).toHaveBeenCalledWith(
      UserSessionEntity,
      expect.objectContaining({
        browser: 'Chrome',
        browser_version: '126.0',
        device: 'Desktop',
        os: 'Linux',
        os_version: null,
        ip_address: '203.0.113.10',
        user_agent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0',
        origin: 'https://app.test.dev',
        location: {
          country_code: null,
          country_name: null,
          region_code: null,
          region_name: null,
          city: null,
          source: null,
          resolved_at: null,
        },
      }),
    );
  });

  it('persists every field from a fully resolved geolocation', async () => {
    const req = { ip: '8.8.8.8', socket: {}, get: jest.fn() };
    const resolvedAt = new Date('2026-07-27T12:00:00.000Z');
    requestContext.get.mockReturnValue(req);
    ipLocation.resolve.mockResolvedValue({
      countryCode: 'US',
      countryName: 'United States',
      regionCode: 'CA',
      regionName: 'California',
      city: 'Mountain View',
      source: 'maxmind',
      resolvedAt,
    });

    await service.issueTokens(user as never, res as never);

    expect(manager.create).toHaveBeenCalledWith(
      UserSessionEntity,
      expect.objectContaining({
        location: {
          country_code: 'US',
          country_name: 'United States',
          region_code: 'CA',
          region_name: 'California',
          city: 'Mountain View',
          source: 'maxmind',
          resolved_at: resolvedAt,
        },
      }),
    );
  });

  it('falls back to null for each missing optional location property', async () => {
    const req = { ip: '8.8.4.4', socket: {}, get: jest.fn() };
    requestContext.get.mockReturnValue(req);
    ipLocation.resolve.mockResolvedValue({});

    await service.issueTokens(user as never, res as never);

    expect(manager.create).toHaveBeenCalledWith(
      UserSessionEntity,
      expect.objectContaining({
        location: {
          country_code: null,
          country_name: null,
          region_code: null,
          region_name: null,
          city: null,
          source: null,
          resolved_at: null,
        },
      }),
    );
  });

  it('revokes a session and clears its refresh cookie', async () => {
    await service.revokeTokens(session as never, res as never);
    expect(manager.update).toHaveBeenCalledWith(UserSessionEntity, 's1', {
      active: false,
      refresh: null,
    });
    expect(res.clearCookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
    );
  });

  it('revokes one session, all sessions, and all other sessions', async () => {
    await service.revokeSession(session as never);
    await service.revokeAllSessions('u1', res as never);
    expect(userRepo.revokeAllSessions).toHaveBeenCalledWith('u1');
    expect(res.clearCookie).toHaveBeenCalled();
    const query = {
      update: jest.fn(),
      set: jest.fn(),
      where: jest.fn(),
      execute: jest.fn(),
    };
    query.update.mockReturnValue(query);
    query.set.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.execute.mockResolvedValue({ affected: 1 });
    manager.createQueryBuilder.mockReturnValue(query);
    await service.revokeOtherSessions('u1', 's1');
    expect(query.where).toHaveBeenCalledWith(
      expect.stringContaining('id != :currentSessionId'),
      { userId: 'u1', currentSessionId: 's1' },
    );
  });

  it('lists only active, non-revoked, non-expired refresh sessions', async () => {
    manager.find.mockResolvedValue([session]);
    await expect(service.findSessions('u1')).resolves.toEqual([session]);
    expect(manager.find).toHaveBeenCalledWith(
      UserSessionEntity,
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
        order: { createdAt: 'DESC' },
      }),
    );
  });

  it('revokes an owned session by id and rejects missing or foreign sessions', async () => {
    manager.findOne.mockResolvedValueOnce(session).mockResolvedValueOnce(null);
    await service.revokeSessionById('u1', 's1');
    expect(manager.update).toHaveBeenCalled();
    await expect(
      service.revokeSessionById('u1', 'foreign'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
