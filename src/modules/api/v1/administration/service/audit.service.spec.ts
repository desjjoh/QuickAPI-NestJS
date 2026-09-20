import { AuditAdministrationService } from './audit.service';
import { AuditSearchQueryDto } from '@/common/models/audit.model';

describe(AuditAdministrationService.name, () => {
  const location = {
    ip: '203.0.113.10',
    countryCode: 'CA',
    countryName: 'Canada',
    regionCode: 'ON',
    regionName: 'Ontario',
    city: 'Ottawa',
    source: 'maxmind' as const,
    resolvedAt: new Date('2026-01-01T00:01:00.000Z'),
  };
  const ipLocations = { resolveIp: jest.fn().mockResolvedValue(location) };
  const unsafeEvent = {
    id: '0123456789abcdef',
    domain: 'identity',
    event: 'user.updated',
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
    ipAddress: '203.0.113.10',
    userAgent: 'browser fingerprint',
    requestId: 'internal-request',
    sessionId: 'internal-session',
    httpMethod: 'PATCH',
    route: '/api/v1/administration/users/:id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('maps search responses to the shared complete audit representation', async () => {
    const queries = {
      query: jest.fn().mockResolvedValue({
        data: [unsafeEvent],
        meta: { page: 1, take: 25 },
      }),
    };
    const response = await new AuditAdministrationService(
      queries as never,
      ipLocations as never,
    ).search(new AuditSearchQueryDto());

    expect(response.data[0]).toEqual(
      expect.objectContaining({
        id: '0123456789abcdef',
        event: 'user.updated',
        ipAddress: '203.0.113.10',
        ipLocation: location,
        userAgent: 'browser fingerprint',
        requestId: 'internal-request',
      }),
    );
    expect(ipLocations.resolveIp).toHaveBeenCalledWith('203.0.113.10');
  });

  it('maps detail responses to the shared complete audit representation', async () => {
    const queries = { findById: jest.fn().mockResolvedValue(unsafeEvent) };
    const response = await new AuditAdministrationService(
      queries as never,
      ipLocations as never,
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
    expect(response.metadata).toEqual(unsafeEvent.metadata);
    expect(response.createdAt).toEqual(unsafeEvent.createdAt);
  });

  it('does not promote unknown metadata values to a reason code', async () => {
    const queries = {
      findById: jest.fn().mockResolvedValue({
        ...unsafeEvent,
        metadata: { reason_code: 'attacker-controlled', secret: 'hidden' },
      }),
    };

    const response = await new AuditAdministrationService(
      queries as never,
      ipLocations as never,
    ).detail('0123456789abcdef');

    expect(response.reasonCode).toBeNull();
    expect(response.metadata).toEqual({
      reason_code: 'attacker-controlled',
      secret: 'hidden',
    });
  });
});
