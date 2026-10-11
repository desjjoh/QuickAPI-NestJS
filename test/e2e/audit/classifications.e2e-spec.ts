import { QueryFailedError } from 'typeorm';
import { AuditSort } from '@/common/models/audit.model';
import { Order } from '@/common/models/pagination.model';
import { AuditQueryService } from '@/modules/domain/audit/services/audit-query.service';
import {
  AuditActorType,
  AuditSource,
  AuditEventDomain,
  AuditSubjectType,
  AuditResourceType,
} from '@/config/audit-events.config';
import { AuditEventEntity } from '@/modules/domain/audit/entities/audit-event.entity';
import {
  setupTestSuite,
  teardownTestSuite,
  type TestSuite,
} from '../../helpers/test-app';

const classifications = [
  ['actor_type', Object.values(AuditActorType), false],
  ['source', Object.values(AuditSource), false],
  ['domain', Object.values(AuditEventDomain), false],
  ['subject_type', Object.values(AuditSubjectType), true],
  ['resource_type', Object.values(AuditResourceType), true],
] as const;

describe('database audit classifications', () => {
  let suite: TestSuite;
  beforeAll(async () => {
    suite = await setupTestSuite();
  });
  afterEach(async () => {
    await suite.resetDatabase();
  });
  afterAll(async () => {
    await teardownTestSuite(suite);
  });

  function insert(overrides: Record<string, unknown> = {}) {
    const repo = suite.dataSource.getRepository(AuditEventEntity);
    return repo.insert({
      id: repo.create().id,
      event: 'identity.future_feature.completed',
      domain: 'identity',
      actor_type: 'system',
      source: 'service',
      subject_type: null,
      resource_type: null,
      occurred_at: new Date(),
      ...overrides,
    });
  }

  it.each(classifications)(
    'enforces the %s catalog in the database, not just the audit service',
    async (column, allowed, nullable) => {
      const repository = suite.dataSource.getRepository(AuditEventEntity);
      const metadata = repository.metadata.findColumnWithPropertyName(column)!;
      expect(metadata.type).toBe('enum');
      expect(metadata.enum).toEqual(allowed);
      expect(metadata.isNullable).toBe(nullable);
      const columns = await suite.dataSource.query(
        'SELECT DATA_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_TYPE AS catalog FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        ['activity_audits', column],
      );
      expect(columns[0].type).toBe('enum');
      expect(columns[0].nullable).toBe(nullable ? 'YES' : 'NO');
      expect(columns[0].catalog).toBe(
        `enum(${allowed.map((value) => `'${value}'`).join(',')})`,
      );
      for (const value of allowed) await insert({ [column]: value });
      const count = await repository.count();
      await expect(
        insert({ [column]: 'not_a_valid_classification' }),
      ).rejects.toBeInstanceOf(QueryFailedError);
      await expect(insert({ [column]: '' })).rejects.toBeInstanceOf(
        QueryFailedError,
      );
      expect(await repository.count()).toBe(count);
      if (nullable) {
        await insert({ [column]: null });
        expect(await repository.count()).toBe(count + 1);
      } else {
        await expect(insert({ [column]: null })).rejects.toBeInstanceOf(
          QueryFailedError,
        );
        expect(await repository.count()).toBe(count);
      }
    },
  );

  it.each([
    [
      AuditSort.ACTOR_TYPE,
      'actor_type',
      Object.values(AuditActorType),
      'actorType',
    ],
    [AuditSort.DOMAIN, 'domain', Object.values(AuditEventDomain), 'domain'],
  ] as const)(
    'preserves lexical pagination when sorting by %s',
    async (sort, column, values, property) => {
      for (const value of values) await insert({ [column]: value });
      const queries = suite.app.get(AuditQueryService);
      for (const order of [Order.ASC, Order.DESC]) {
        const expected = [...values].sort();
        if (order === Order.DESC) expected.reverse();
        const actual: string[] = [];
        for (let page = 1; page <= values.length; page++) {
          const result = await queries.query({ sort, order, take: 1, page });
          expect(result.meta.itemCount).toBe(values.length);
          actual.push(result.data[0][property]);
        }
        expect(actual).toEqual(expected);
      }
    },
  );

  it('keeps extensible event names and historical identifiers as strings', async () => {
    await insert({
      actor_id: 'historical-missing-actor',
      subject_id: 'retained-subject',
      resource_id: 'retained-resource',
    });
    const event = await suite.dataSource
      .getRepository(AuditEventEntity)
      .findOneByOrFail({ actor_id: 'historical-missing-actor' });
    expect(event.event).toBe('identity.future_feature.completed');
    expect(event.actor_user_id).toBeNull();
    expect(event.subject_id).toBe('retained-subject');
    expect(event.resource_id).toBe('retained-resource');
    expect(
      suite.dataSource
        .getMetadata(AuditEventEntity)
        .findColumnWithPropertyName('event')!.type,
    ).toBe('varchar');
  });
});
