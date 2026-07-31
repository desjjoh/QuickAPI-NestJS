jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import type { Response } from 'express';
import type { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { SessionDto } from '@/modules/domain/identity/models/user.model';
import {
  sessionFixture,
  userFixture,
} from '@/../test/helpers/identity.fixtures';
import { SessionsApiService } from './sessions.service';

describe('SessionsApiService', () => {
  const user = userFixture();
  const current = sessionFixture();
  const res = { clearCookie: jest.fn() } as unknown as Response;
  const setup = () => {
    const refreshSvc = {
      findSessions: jest.fn().mockResolvedValue([current]),
      revokeTokens: jest.fn(),
      revokeSessionById: jest.fn(),
      revokeAllSessions: jest.fn(),
    };
    const auditSvc = { record: jest.fn().mockResolvedValue({}) };
    return {
      service: new SessionsApiService(
        refreshSvc as unknown as RefreshService,
        auditSvc as never,
      ),
      refreshSvc,
      auditSvc,
    };
  };

  it('lists sessions as returned DTOs', async () => {
    const { service, refreshSvc } = setup();
    const result = await service.findAll(user);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(SessionDto);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: current.id,
        browser: 'Firefox',
        countryCode: 'CA',
      }),
    );
    expect(refreshSvc.findSessions).toHaveBeenCalledWith(user.id);
  });

  it('protects current-session semantics by revoking its tokens and cookies', async () => {
    const { service, refreshSvc, auditSvc } = setup();
    await service.revoke(user, current, current.id, res);
    expect(refreshSvc.revokeTokens).toHaveBeenCalledWith(current, res);
    expect(refreshSvc.revokeSessionById).not.toHaveBeenCalled();
    expect(auditSvc.record).toHaveBeenCalledWith({
      event: 'identity.session.revoked',
      domain: 'identity',
      outcome: 'succeeded',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'identity.session',
      resourceId: current.id,
      sessionId: current.id,
      source: 'http',
      metadata: {},
    });
  });

  it('revokes an individual non-current session for the owning user', async () => {
    const { service, refreshSvc, auditSvc } = setup();
    await service.revoke(user, current, 'other-session', res);
    expect(refreshSvc.revokeSessionById).toHaveBeenCalledWith(
      user.id,
      'other-session',
    );
    expect(refreshSvc.revokeTokens).not.toHaveBeenCalled();
    expect(auditSvc.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'identity.session.revoked',
        resourceId: 'other-session',
        sessionId: 'other-session',
      }),
    );
  });

  it('revokes all sessions and delegates cookie cleanup', async () => {
    const { service, refreshSvc, auditSvc } = setup();
    await service.revokeAll(user, res);
    expect(refreshSvc.revokeAllSessions).toHaveBeenCalledWith(user.id, res);
    expect(auditSvc.record).toHaveBeenCalledWith({
      event: 'identity.session.all_revoked',
      domain: 'identity',
      outcome: 'succeeded',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'identity.user',
      resourceId: user.id,
      source: 'http',
      metadata: { session_ids: [current.id] },
    });
  });
});
