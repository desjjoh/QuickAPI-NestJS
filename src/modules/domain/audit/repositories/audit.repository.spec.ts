import type {
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { AuditSort } from '@/common/models/audit.model';
import { Order, PaginationOptions } from '@/common/models/pagination.model';

import { AuditEventEntity } from '../entities/audit-event.entity';
import { AuditRepository } from './audit.repository';

function entity(id: string): AuditEventEntity {
  return { id } as AuditEventEntity;
}

function setup(rows: AuditEventEntity[] = [], itemCount = rows.length) {
  const builder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([rows, itemCount]),
  };
  const persistence = {
    createQueryBuilder: jest.fn().mockReturnValue(builder),
    findOne: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn().mockReturnValue(persistence),
  } as unknown as EntityManager;
  const dataSource = {
    getRepository: jest
      .fn()
      .mockReturnValue({ manager, target: AuditEventEntity }),
  } as unknown as DataSource;

  return {
    repository: new AuditRepository(dataSource),
    persistence: persistence as unknown as jest.Mocked<
      Pick<Repository<AuditEventEntity>, 'createQueryBuilder' | 'findOne'>
    >,
    builder: builder as unknown as jest.Mocked<
      Pick<
        SelectQueryBuilder<AuditEventEntity>,
        | 'andWhere'
        | 'orderBy'
        | 'addOrderBy'
        | 'take'
        | 'skip'
        | 'getManyAndCount'
      >
    >,
    manager,
  };
}

describe('AuditRepository', () => {
  it('queries through the supplied manager with deterministic pagination', async () => {
    const rows = [entity('audit-1')];
    const { repository, persistence, builder, manager } = setup(rows, 5);
    const pageOptions = Object.assign(new PaginationOptions(), {
      page: 2,
      take: 2,
    });

    await expect(
      repository.query(
        manager,
        {},
        pageOptions,
        AuditSort.OCCURRED_AT,
        Order.DESC,
      ),
    ).resolves.toEqual([rows, 5]);

    expect(persistence.createQueryBuilder).toHaveBeenCalledWith('audit');
    expect(builder.orderBy).toHaveBeenCalledWith('audit.occurred_at', 'DESC');
    expect(builder.addOrderBy).toHaveBeenCalledWith('audit.id', 'DESC');
    expect(builder.take).toHaveBeenCalledWith(2);
    expect(builder.skip).toHaveBeenCalledWith(2);
  });

  it('applies only supplied indexed filters and date bounds', async () => {
    const { repository, builder, manager } = setup();
    const occurredFrom = new Date('2026-01-01T00:00:00.000Z');
    const occurredTo = new Date('2026-02-01T00:00:00.000Z');

    await repository.query(
      manager,
      {
        domain: 'identity',
        actorId: null,
        subjectId: 'user-1',
        occurredFrom,
        occurredTo,
      },
      Object.assign(new PaginationOptions(), { page: 1, take: 25 }),
      AuditSort.EVENT,
      Order.ASC,
    );

    expect(builder.andWhere.mock.calls).toEqual(
      expect.arrayContaining([
        ['audit.domain = :domain', { domain: 'identity' }],
        ['audit.actor_id IS NULL'],
        ['audit.subject_id = :subjectId', { subjectId: 'user-1' }],
        ['audit.occurred_at >= :occurredFrom', { occurredFrom }],
        ['audit.occurred_at <= :occurredTo', { occurredTo }],
      ]),
    );
    expect(builder.orderBy).toHaveBeenCalledWith('audit.event', 'ASC');
  });

  it('uses the supplied manager for common reads', async () => {
    const row = entity('audit-1');
    const { repository, persistence, manager } = setup();
    persistence.findOne.mockResolvedValue(row);

    await expect(repository.findById(manager, row.id)).resolves.toBe(row);
    expect(persistence.findOne).toHaveBeenCalledWith({
      where: { id: row.id },
    });
  });

  it('does not expose mutation methods', () => {
    const { repository } = setup();
    expect(repository).not.toHaveProperty('create');
    expect(repository).not.toHaveProperty('save');
    expect(repository).not.toHaveProperty('insert');
    expect(repository).not.toHaveProperty('update');
    expect(repository).not.toHaveProperty('delete');
    expect(repository).not.toHaveProperty('remove');
  });
});
