import type { AuditRepository } from '../repositories/audit.repository';
import { AuditQueryService } from './audit-query.service';

describe('AuditQueryService', () => {
  function setup() {
    const repository = {
      queryAudit: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      queryActorActivity: jest
        .fn()
        .mockResolvedValue({ events: [], hasMore: false }),
    };
    return {
      service: new AuditQueryService(repository as unknown as AuditRepository),
      repository,
    };
  }

  it('delegates the general bounded query unchanged', async () => {
    const { service, repository } = setup();
    const filters = {
      domain: 'identity',
      outcome: 'succeeded' as const,
      occurredFrom: new Date('2026-01-01T00:00:00.000Z'),
      take: 10,
    };
    await service.query(filters);
    expect(repository.queryAudit).toHaveBeenCalledWith(filters);
  });

  it('delegates actor cursor activity without widening its filters', async () => {
    const { service, repository } = setup();
    const filters = {
      domain: 'identity',
      event: 'identity.profile.updated',
      outcome: 'succeeded' as const,
      occurredFrom: new Date('2026-01-01T00:00:00.000Z'),
      occurredTo: new Date('2026-01-31T23:59:59.999Z'),
    };
    const cursor = {
      occurredAt: new Date('2026-01-15T00:00:00.000Z'),
      id: 'abcdefghijklmnop',
    };
    await service.actorActivity('user', 'user-id', filters, cursor, 25);
    expect(repository.queryActorActivity).toHaveBeenCalledWith(
      'user',
      'user-id',
      filters,
      cursor,
      25,
    );
  });

  it.each([
    [
      'byActor',
      ['user', 'actor-id'],
      { actorType: 'user', actorId: 'actor-id' },
    ],
    [
      'bySubject',
      ['user', 'subject-id'],
      { subjectType: 'user', subjectId: 'subject-id' },
    ],
    [
      'resourceHistory',
      ['image', 'resource-id'],
      { resourceType: 'image', resourceId: 'resource-id' },
    ],
    ['byDomain', ['identity'], { domain: 'identity' }],
    ['byRequest', ['request-id'], { requestId: 'request-id' }],
    ['bySession', ['session-id'], { sessionId: 'session-id' }],
  ] as const)('constructs the %s query', async (method, args, expected) => {
    const { service, repository } = setup();
    const invoke = service[method] as (...values: string[]) => Promise<unknown>;
    await invoke.apply(service, [...args]);
    expect(repository.queryAudit).toHaveBeenCalledWith(expected);
  });

  it('combines convenience query options with its enforced scope', async () => {
    const { service, repository } = setup();
    await service.byActor('user', 'actor-id', {
      event: 'identity.updated',
      take: 5,
    });
    expect(repository.queryAudit).toHaveBeenCalledWith({
      event: 'identity.updated',
      take: 5,
      actorType: 'user',
      actorId: 'actor-id',
    });
  });
});
