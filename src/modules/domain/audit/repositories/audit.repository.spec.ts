import { BadRequestException } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';

import { AuditEventEntity } from '../entities/audit-event.entity';
import { AuditRepository } from './audit.repository';

function entity(id: string, occurredAt: string) {
  return {
    id,
    createdAt: new Date(occurredAt),
    updatedAt: new Date(occurredAt),
    domain: 'identity',
    event: 'user.updated',
    outcome: 'succeeded',
    actor_type: 'user',
    actor_id: 'actor-1',
    subject_type: 'user',
    subject_id: 'subject-1',
    resource_type: 'user',
    resource_id: 'resource-1',
    operation_id: null,
    request_id: 'request-1',
    session_id: 'session-1',
    ip_address: null,
    user_agent: null,
    http_method: null,
    route: null,
    failure_reason: null,
    failure_code: null,
    source: 'api',
    occurred_at: new Date(occurredAt),
    before: null,
    after: null,
    changes: null,
    metadata: null,
    error: null,
  } as AuditEventEntity;
}

function setup(rows: AuditEventEntity[], itemCount = rows.length) {
  const builder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([rows, itemCount]),
  };
  const repository = new AuditRepository({
    createEntityManager: jest.fn(() => ({})),
  } as unknown as DataSource);
  jest
    .spyOn(repository, 'createQueryBuilder')
    .mockReturnValue(
      builder as unknown as SelectQueryBuilder<AuditEventEntity>,
    );
  return { repository, builder };
}

describe('AuditRepository page pagination', () => {
  it('uses the same default page shape as user administration', async () => {
    const { repository, builder } = setup([]);

    await expect(repository.queryAudit({})).resolves.toEqual({
      data: [],
      meta: {
        page: 1,
        take: 25,
        itemCount: 0,
        pageCount: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });
    expect(builder.take).toHaveBeenCalledWith(25);
    expect(builder.skip).toHaveBeenCalledWith(0);
  });

  it('calculates page offsets and standard pagination metadata', async () => {
    const rows = [entity('b', '2026-01-02T00:00:00.000Z')];
    const { repository, builder } = setup(rows, 5);

    const result = await repository.queryAudit({ page: 2, take: 2 });

    expect(result.data.map(({ id }) => id)).toEqual(['b']);
    expect(result.meta).toEqual({
      page: 2,
      take: 2,
      itemCount: 5,
      pageCount: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
    expect(builder.skip).toHaveBeenCalledWith(2);
  });

  it('retains deterministic audit ordering', async () => {
    const { repository, builder } = setup([]);
    await repository.queryAudit({});
    expect(builder.orderBy).toHaveBeenCalledWith('audit.occurred_at', 'DESC');
    expect(builder.addOrderBy).toHaveBeenCalledWith('audit.id', 'DESC');
  });

  it.each([
    [{ page: 0 }, 'page must be a positive integer'],
    [{ take: 101 }, 'take must be between 1 and 100'],
  ])('rejects invalid page options', async (query, message) => {
    const { repository } = setup([]);
    await expect(repository.queryAudit(query)).rejects.toThrow(message);
    await expect(repository.queryAudit(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('combines indexed filters with page pagination', async () => {
    const { repository, builder } = setup([]);
    await repository.queryAudit({
      page: 3,
      take: 10,
      domain: 'identity',
      event: 'user.updated',
      actorType: 'user',
      actorId: 'actor-1',
      outcome: 'succeeded',
    });

    expect(builder.skip).toHaveBeenCalledWith(20);
    expect(builder.andWhere.mock.calls).toEqual(
      expect.arrayContaining([
        ['audit.domain = :domain', { domain: 'identity' }],
        ['audit.event = :event', { event: 'user.updated' }],
        ['audit.outcome = :outcome', { outcome: 'succeeded' }],
        ['audit.actor_type = :actorType', { actorType: 'user' }],
        ['audit.actor_id = :actorId', { actorId: 'actor-1' }],
      ]),
    );
  });
});
