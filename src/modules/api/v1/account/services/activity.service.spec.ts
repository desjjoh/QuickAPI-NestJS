import type { AuditEvent } from '@/modules/domain/audit/models/audit-query-result.model';
import type { AuditQueryService } from '@/modules/domain/audit/services/audit-query.service';
import { userFixture } from '@/../test/helpers/identity.fixtures';
import { AuditEventOutcome } from '@/common/models/audit.model';
import { ActivityApiService } from './activity.service';

const location = {
  ip: '192.0.2.1',
  countryCode: null,
  countryName: null,
  regionCode: null,
  regionName: null,
  city: null,
  source: 'unknown' as const,
  resolvedAt: new Date('2026-01-02T03:05:00.000Z'),
};

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'abcdefghijklmnop',
    domain: 'identity',
    event: 'identity.profile.updated',
    outcome: 'succeeded',
    actorType: 'admin',
    actorId: 'administrator-id',
    subjectType: 'user',
    subjectId: 'subject-id',
    resourceType: 'identity.user',
    resourceId: 'resource-id',
    occurredAt: new Date('2026-01-02T03:04:05.000Z'),
    ipAddress: '192.0.2.1',
    userAgent: 'private client',
    failureReason: 'internal reason',
    metadata: { administratorNote: 'private' },
    ...overrides,
  } as AuditEvent;
}

describe('ActivityApiService', () => {
  const user = userFixture();

  function setup(
    result = {
      data: [event()],
      meta: {
        page: 1,
        take: 25,
        itemCount: 1,
        pageCount: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    },
  ) {
    const auditQueries = {
      query: jest.fn().mockResolvedValue(result),
    };
    const ipLocations = { resolveIp: jest.fn().mockResolvedValue(location) };

    return {
      service: new ActivityApiService(
        auditQueries as unknown as AuditQueryService,
        ipLocations as never,
      ),
      auditQueries,
      ipLocations,
    };
  }

  it('derives the account subject from the authenticated entity and forwards filters', async () => {
    const { service, auditQueries } = setup();
    const occurredFrom = new Date('2026-01-01T00:00:00.000Z');
    const occurredTo = new Date('2026-01-31T23:59:59.999Z');

    await service.findForUser(user, {
      domain: 'identity',
      event: 'identity.profile.updated',
      outcome: AuditEventOutcome.SUCCEEDED,
      occurredFrom,
      occurredTo,
      page: 2,
      take: 10,
    });

    expect(auditQueries.query).toHaveBeenCalledWith({
      subjectType: 'user',
      subjectId: user.id,
      domain: 'identity',
      event: 'identity.profile.updated',
      outcome: AuditEventOutcome.SUCCEEDED,
      occurredFrom,
      occurredTo,
      page: 2,
      take: 10,
    });
  });

  it('maps events to the shared complete audit representation', async () => {
    const { service } = setup();
    const result = await service.findForUser(user, { page: 1, take: 25 });

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'abcdefghijklmnop',
        domain: 'identity',
        event: 'identity.profile.updated',
        outcome: 'succeeded',
        actorType: 'admin',
        actorId: 'administrator-id',
        subjectType: 'user',
        subjectId: 'subject-id',
        resourceType: 'identity.user',
        resourceId: 'resource-id',
        occurredAt: new Date('2026-01-02T03:04:05.000Z'),
        ipAddress: '192.0.2.1',
        ipLocation: location,
        userAgent: 'private client',
        failureReason: 'internal reason',
        metadata: { administratorNote: 'private' },
      }),
    );
  });

  it('returns standard page metadata', async () => {
    const { service } = setup();
    const result = await service.findForUser(user, { page: 1, take: 25 });
    expect(result.meta).toEqual({
      page: 1,
      take: 25,
      itemCount: 1,
      pageCount: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });

  it('rejects an inverted occurred-at range before querying', async () => {
    const { service, auditQueries } = setup();
    await expect(
      service.findForUser(user, {
        occurredFrom: new Date('2026-02-01T00:00:00.000Z'),
        occurredTo: new Date('2026-01-01T00:00:00.000Z'),
        page: 1,
        take: 25,
      }),
    ).rejects.toThrow('occurredFrom must not follow occurredTo');
    expect(auditQueries.query).not.toHaveBeenCalled();
  });
});
