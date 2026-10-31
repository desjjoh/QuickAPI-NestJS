import type {
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { AuditSort } from '@/common/models/audit.model';
import { Order, PaginationOptions } from '@/common/models/pagination.model';

import { AuditEventEntity } from '@/modules/domain/audit/entities/audit-event.entity';
import { AuditRepository } from '@/modules/domain/audit/repositories/audit.repository';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';

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
  it('keeps audit persistence append-only', () => {
    const repository = Object.create(
      AuditRepository.prototype,
    ) as AuditRepository;
    expect(repository.insert).toEqual(expect.any(Function));
    for (const method of ['save', 'update', 'patch', 'remove', 'deleteWhere']) {
      expect(repository).not.toHaveProperty(method);
    }
  });
  it.each([
    [AuditSort.DOMAIN, 'CAST(audit.domain AS CHAR)'],
    [AuditSort.ACTOR_TYPE, 'CAST(audit.actor_type AS CHAR)'],
  ])(
    'preserves lexical sorting for enum field %s',
    async (sort, expression) => {
      const { repository, builder, manager } = setup();
      await repository.query(
        manager,
        {},
        new PaginationOptions(),
        sort,
        Order.ASC,
      );
      expect(builder.orderBy).toHaveBeenCalledWith(expression, Order.ASC);
      expect(builder.addOrderBy).toHaveBeenCalledWith('audit.id', Order.ASC);
    },
  );

  it('selects only bounded actor display data without loading eager user relations', async () => {
    const { repository } = setup();
    const rows = [{ id: 'actor-1' }];
    const display = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
    const persistence = {
      createQueryBuilder: jest.fn().mockReturnValue(display),
    };
    const manager = { getRepository: jest.fn().mockReturnValue(persistence) };
    await expect(
      repository.findActorUsers(manager as never, ['actor-1']),
    ).resolves.toBe(rows);
    expect(manager.getRepository).toHaveBeenCalledWith(UserEntity);
    expect(display.select).toHaveBeenCalledWith([
      'actor.id AS id',
      'actor.identity.email AS email',
      'profile.name.first AS first',
      'profile.name.last AS last',
      'profile.name.preferred AS preferred',
      'status.key AS status_key',
      'status.label AS status_label',
      'avatar.id AS avatar_id',
      'avatar.storage_key AS avatar_key',
    ]);
    expect(display.where).toHaveBeenCalledWith('actor.id IN (:...ids)', {
      ids: ['actor-1'],
    });
    expect(display.leftJoin).toHaveBeenCalledWith(
      'profile.media.avatar',
      'avatar',
    );
    expect(display.innerJoin.mock.calls).toEqual([
      ['actor.profile', 'profile'],
      ['actor.status', 'status'],
    ]);
    manager.getRepository.mockClear();
    await expect(
      repository.findActorUsers(manager as never, []),
    ).resolves.toEqual([]);
    expect(manager.getRepository).not.toHaveBeenCalled();
  });

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
});
