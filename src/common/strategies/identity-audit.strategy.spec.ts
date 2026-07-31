import { UnauthorizedException } from '@nestjs/common';

import {
  AUDIT_EVENT_MATRIX,
  AuditEventDomain,
} from '@/config/audit-events.config';
import { hashAuditIdentifier } from '@/modules/domain/audit/helpers/audit-privacy.helper';

import { LocalStrategy } from './local.strategy';
import { RefreshTokenStrategy } from './refresh.strategy';

describe('authentication strategy audit events', () => {
  it('records the exact anonymous sign-in failure after credentials are rejected', async () => {
    const error = new UnauthorizedException('Invalid credentials');
    const users = { validateUser: jest.fn().mockRejectedValue(error) };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const strategy = new LocalStrategy(users as never, audit as never);

    await expect(
      strategy.validate(' Person@Example.TEST ', 'not-recorded'),
    ).rejects.toBe(error);
    expect(audit.record).toHaveBeenCalledWith({
      event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].SIGN_IN_FAILED,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'failed',
      actorType: 'anonymous',
      source: 'http',
      metadata: {
        identifier_hash: hashAuditIdentifier('person@example.test'),
      },
      failureCode: 'UnauthorizedException',
    });
    expect(audit.record.mock.calls[0][0]).not.toHaveProperty('email');
  });

  it('records the exact refresh failure after session validation is rejected', async () => {
    const repository = { findByIdOrFail: jest.fn(), manager: {} };
    const users = { assertCanAuthenticate: jest.fn() };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const strategy = new RefreshTokenStrategy(
      repository as never,
      users as never,
      audit as never,
    );
    const payload = {
      sub: 'user-1',
      sid: 'session-1',
      email: 'not-audited@example.test',
      version: 1,
    };

    await expect(
      strategy.validate({ cookies: {} } as never, payload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith({
      event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].REFRESH_FAILED,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'failed',
      actorType: 'anonymous',
      source: 'http',
      metadata: {},
      sessionId: 'session-1',
      subjectType: 'user',
      subjectId: 'user-1',
      failureCode: 'UnauthorizedException',
    });
  });
});
