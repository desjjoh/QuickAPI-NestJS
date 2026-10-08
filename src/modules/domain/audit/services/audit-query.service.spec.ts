import { BadRequestException } from '@nestjs/common';

import { AuditSort } from '@/common/models/audit.model';
import { Order } from '@/common/models/pagination.model';
import { AuditActorType } from '@/config/audit-events.config';

import type { AuditEventEntity } from '../entities/audit-event.entity';
import type { AuditRepository } from '../repositories/audit.repository';
import { AuditQueryService } from './audit-query.service';

function entity(id = 'audit-1'): AuditEventEntity {
  const occurredAt = new Date('2026-01-02T00:00:00.000Z');
  return {
    id,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    domain: 'identity',
    event: 'identity.user.updated',
    actor_type: AuditActorType.USER,
    actor_id: 'actor-1',
    subject_type: 'user',
    subject_id: 'subject-1',
    resource_type: 'identity.user',
    resource_id: 'resource-1',
    operation_id: 'operation-1',
    request_id: 'request-1',
    session_id: 'session-1',
    ip_address: null,
    user_agent: null,
    http_method: null,
    route: null,
    source: 'http',
    occurred_at: occurredAt,
    before: null,
    after: null,
    changes: null,
    metadata: null,
  } as AuditEventEntity;
}

describe('AuditQueryService', () => {
  function setup(rows: AuditEventEntity[] = [], itemCount = rows.length) {
    const manager = {};
    const repository = {
      manager,
      query: jest.fn().mockResolvedValue([rows, itemCount]),
      findById: jest.fn(),
    };
    return {
      service: new AuditQueryService(repository as unknown as AuditRepository),
      repository,
      manager,
    };
  }

  it('owns defaults, validation, mapping, and pagination metadata', async () => {
    const row = entity();
    const { service, repository, manager } = setup([row], 5);

    const result = await service.query({ page: 2, take: 2 });

    expect(repository.query).toHaveBeenCalledWith(
      manager,
      { page: 2, take: 2 },
      expect.objectContaining({ page: 2, take: 2, skip: 2 }),
      AuditSort.OCCURRED_AT,
      Order.DESC,
    );
    expect(result.data.map(({ id }) => id)).toEqual([row.id]);
    expect(result.meta).toEqual({
      page: 2,
      take: 2,
      itemCount: 5,
      pageCount: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it('passes bounded sort and order values to the repository', async () => {
    const { service, repository, manager } = setup();
    await service.query({ sort: AuditSort.EVENT, order: Order.ASC });
    expect(repository.query).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        sort: AuditSort.EVENT,
        order: Order.ASC,
      }),
      expect.any(Object),
      AuditSort.EVENT,
      Order.ASC,
    );
  });

  it.each([
    [{ page: 0 }, 'page must be a positive integer'],
    [{ take: 101 }, 'take must be between 1 and 100'],
    [{ sort: 'invalid' }, 'sort is invalid'],
    [{ order: 'invalid' }, 'order is invalid'],
    [
      {
        occurredFrom: new Date('2026-02-01T00:00:00.000Z'),
        occurredTo: new Date('2026-01-01T00:00:00.000Z'),
      },
      'occurredFrom must not follow occurredTo',
    ],
  ])('rejects invalid query input', async (query, message) => {
    const { service, repository } = setup();
    await expect(service.query(query as never)).rejects.toThrow(message);
    await expect(service.query(query as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.query).not.toHaveBeenCalled();
  });

  it('maps a manager-scoped repository lookup to an immutable model', async () => {
    const row = entity();
    const { service, repository, manager } = setup();
    repository.findById.mockResolvedValue(row);

    const result = await service.findById(row.id);

    expect(repository.findById).toHaveBeenCalledWith(manager, row.id);
    expect(result).toEqual(expect.objectContaining({ id: row.id }));
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('returns null when an audit event does not exist', async () => {
    const { service, repository } = setup();
    repository.findById.mockResolvedValue(null);
    await expect(service.findById('missing')).resolves.toBeNull();
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
    const { service, repository, manager } = setup();
    const invoke = service[method] as unknown as (
      ...values: string[]
    ) => Promise<unknown>;
    await invoke.apply(service, [...args]);
    expect(repository.query).toHaveBeenCalledWith(
      manager,
      expected,
      expect.objectContaining({ page: 1, take: 25 }),
      AuditSort.OCCURRED_AT,
      Order.DESC,
    );
  });

  it('combines convenience query options with its enforced scope', async () => {
    const { service, repository } = setup();
    await service.byActor(AuditActorType.USER, 'actor-id', {
      event: 'identity.updated',
      take: 5,
    });
    expect(repository.query.mock.calls[0][1]).toEqual({
      event: 'identity.updated',
      take: 5,
      actorType: AuditActorType.USER,
      actorId: 'actor-id',
    });
  });
});
