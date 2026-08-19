import { AuditAdministrationService } from './audit.service';
import { AuditSearchQueryDto } from '../models/audit.model';

describe(AuditAdministrationService.name, () => {
  const unsafeEvent = {
    id: '0123456789abcdef',
    domain: 'identity',
    event: 'user.updated',
    outcome: 'succeeded',
    actorType: 'user',
    actorId: 'actor-1',
    subjectType: 'user',
    subjectId: 'subject-1',
    resourceType: 'identity.user',
    resourceId: 'subject-1',
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    metadata: {
      reason_code: 'policy_enforcement',
      authorization: 'Bearer secret',
    },
    before: { email: '[REDACTED]' },
    after: { password: '[CHANGED]' },
    changes: { password: true },
    error: { stack: 'internal stack' },
    ipAddress: '203.0.113.10',
    userAgent: 'browser fingerprint',
    requestId: 'internal-request',
    sessionId: 'internal-session',
    httpMethod: 'PATCH',
    route: '/api/v1/administration/users/:id',
    failureReason: 'private failure detail',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('defensively allowlists search responses', async () => {
    const queries = {
      query: jest.fn().mockResolvedValue({
        data: [unsafeEvent],
        meta: { page: 1, take: 25 },
      }),
    };
    const response = await new AuditAdministrationService(
      queries as never,
    ).search(new AuditSearchQueryDto());
    const serialized = JSON.stringify(response);

    expect(response.data[0]).toEqual(
      expect.objectContaining({
        id: '0123456789abcdef',
        event: 'user.updated',
      }),
    );
    expect(serialized).not.toMatch(
      /Bearer secret|private@example|secret-password|secret-token|internal stack|203\.0\.113|browser fingerprint|internal-request|internal-session|private failure/,
    );
    expect(Object.keys(response.data[0]).sort()).toEqual(
      [
        'actorId',
        'actorType',
        'domain',
        'event',
        'id',
        'occurredAt',
        'outcome',
        'resourceId',
        'resourceType',
        'subjectId',
        'subjectType',
      ].sort(),
    );
  });

  it('returns only explicitly allowlisted detail fields', async () => {
    const queries = { findById: jest.fn().mockResolvedValue(unsafeEvent) };
    const response = await new AuditAdministrationService(
      queries as never,
    ).detail('0123456789abcdef');

    expect(response).toMatchObject({
      reasonCode: 'policy_enforcement',
      before: { email: '[REDACTED]' },
      after: { password: '[CHANGED]' },
      changes: { password: true },
      sessionId: 'internal-session',
      requestId: 'internal-request',
      httpMethod: 'PATCH',
      route: '/api/v1/administration/users/:id',
    });
    expect(JSON.stringify(response)).not.toContain('Bearer secret');
    expect(response).not.toHaveProperty('metadata');
    expect(response).not.toHaveProperty('createdAt');
  });

  it('rejects unknown reason codes rather than exposing metadata values', async () => {
    const queries = {
      findById: jest.fn().mockResolvedValue({
        ...unsafeEvent,
        metadata: { reason_code: 'attacker-controlled', secret: 'hidden' },
      }),
    };

    const response = await new AuditAdministrationService(
      queries as never,
    ).detail('0123456789abcdef');

    expect(response.reasonCode).toBeNull();
    expect(JSON.stringify(response)).not.toMatch(/attacker-controlled|hidden/);
  });
});
