jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));
jest.mock('../models/jwt.model', () => ({
  JWTDto: class {
    public constructor(values: Record<string, unknown>) {
      Object.assign(this, values);
    }
  },
}));

import { NotFoundException } from '@nestjs/common';

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

  it('creates a refresh session, rotates it, hashes refresh state, and issues the cookie', async () => {
    const result = await service.issueTokens(user as never, res as never);
    expect(manager.create).toHaveBeenCalledWith(
      UserSessionEntity,
      expect.objectContaining({
        user,
        token_version: 0,
        active: true,
        refresh: null,
      }),
    );
    expect(tokenSvc.createTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u1', sid: 'new-session', version: 1 }),
    );
    expect(manager.save).toHaveBeenLastCalledWith(
      UserSessionEntity,
      expect.objectContaining({ refresh: 'refresh-hash' }),
    );
    expect(manager.save).not.toHaveBeenCalledWith(
      UserSessionEntity,
      expect.objectContaining({ refresh: 'refresh-plain' }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      expect.any(String),
      'refresh-plain',
      expect.any(Object),
    );
    expect(result.access_token).toBe('access');
  });

  it('rotates an existing request session rather than creating another', async () => {
    requestContext.get.mockReturnValue({ user: { sessionEntity: session } });
    await service.issueTokens(user as never, res as never);
    expect(manager.create).not.toHaveBeenCalled();
    expect(tokenSvc.createTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({ sid: 's1', version: 1 }),
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
