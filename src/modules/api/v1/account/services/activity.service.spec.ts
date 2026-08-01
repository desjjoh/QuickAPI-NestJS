import { BadRequestException } from '@nestjs/common';
import type { AuditEvent } from '@/modules/domain/audit/models/audit-query-result.model';
import type { AuditQueryService } from '@/modules/domain/audit/services/audit-query.service';
import { userFixture } from '@/../test/helpers/identity.fixtures';
import { AccountActivityOutcome } from '../models/activity.model';
import { ActivityApiService } from './activity.service';

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'abcdefghijklmnop',
    domain: 'identity',
    event: 'identity.profile.updated',
    outcome: 'succeeded',
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

  function setup(result = { events: [event()], hasMore: false }) {
    const auditQueries = {
      actorActivity: jest.fn().mockResolvedValue(result),
    };
    return {
      service: new ActivityApiService(
        auditQueries as unknown as AuditQueryService,
      ),
      auditQueries,
    };
  }

  it('derives a user actor from the authenticated entity and forwards filters', async () => {
    const { service, auditQueries } = setup();
    const occurredFrom = new Date('2026-01-01T00:00:00.000Z');
    const occurredTo = new Date('2026-01-31T23:59:59.999Z');

    await service.findForUser(user, {
      domain: 'identity',
      event: 'identity.profile.updated',
      outcome: AccountActivityOutcome.SUCCEEDED,
      occurredFrom,
      occurredTo,
      take: 10,
    });

    expect(auditQueries.actorActivity).toHaveBeenCalledWith(
      'user',
      user.id,
      {
        domain: 'identity',
        event: 'identity.profile.updated',
        outcome: AccountActivityOutcome.SUCCEEDED,
        occurredFrom,
        occurredTo,
      },
      undefined,
      10,
    );
  });

  it('maps only account-safe event fields', async () => {
    const { service } = setup();
    const result = await service.findForUser(user, { take: 25 });

    expect(result.data[0]).toEqual({
      id: 'abcdefghijklmnop',
      domain: 'identity',
      event: 'identity.profile.updated',
      outcome: 'succeeded',
      subjectType: 'user',
      subjectId: 'subject-id',
      resourceType: 'identity.user',
      resourceId: 'resource-id',
      occurredAt: new Date('2026-01-02T03:04:05.000Z'),
    });
    expect(result.data[0]).not.toHaveProperty('ipAddress');
    expect(result.data[0]).not.toHaveProperty('userAgent');
    expect(result.data[0]).not.toHaveProperty('failureReason');
    expect(result.data[0]).not.toHaveProperty('metadata');
  });

  it('returns a cursor and accepts it on the next request', async () => {
    const first = setup({ events: [event()], hasMore: true });
    const firstPage = await first.service.findForUser(user, { take: 1 });
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const second = setup({ events: [], hasMore: false });
    await second.service.findForUser(user, {
      cursor: firstPage.nextCursor!,
      take: 1,
    });
    expect(second.auditQueries.actorActivity).toHaveBeenCalledWith(
      'user',
      user.id,
      expect.any(Object),
      {
        occurredAt: new Date('2026-01-02T03:04:05.000Z'),
        id: 'abcdefghijklmnop',
      },
      1,
    );
  });

  it.each(['not-base64-json', Buffer.from('{}').toString('base64url')])(
    'rejects an invalid cursor',
    async (cursor) => {
      const { service, auditQueries } = setup();
      await expect(
        service.findForUser(user, { cursor, take: 25 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(auditQueries.actorActivity).not.toHaveBeenCalled();
    },
  );

  it('rejects an inverted occurred-at range before querying', async () => {
    const { service, auditQueries } = setup();
    await expect(
      service.findForUser(user, {
        occurredFrom: new Date('2026-02-01T00:00:00.000Z'),
        occurredTo: new Date('2026-01-01T00:00:00.000Z'),
        take: 25,
      }),
    ).rejects.toThrow('occurredFrom must not follow occurredTo');
    expect(auditQueries.actorActivity).not.toHaveBeenCalled();
  });
});
