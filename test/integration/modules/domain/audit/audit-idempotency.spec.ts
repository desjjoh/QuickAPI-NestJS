import { AuditService } from '@/modules/domain/audit/services/audit.service';
import { AuditRedactionService } from '@/modules/domain/audit/services/audit-redaction.service';
import { RequestContext } from '@/common/store/request-context.store';
import { IdempotencyService } from '@/modules/system/idempotency/services/idempotency.service';
import { AuditEventDomain } from '@/config/audit-events.config';
import { idempotencyTestStore } from '../../../../helpers/idempotency-test-store';

describe('audit correlation with idempotent execution', () => {
  it('persists keys across concurrent scopes, skips replay audits and leaves unkeyed events null', async () => {
    const store = idempotencyTestStore();
    const idempotency = new IdempotencyService(store.repository);
    const manager = {
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((_entity: unknown, value: unknown) => value),
      insert: jest.fn().mockResolvedValue({}),
    };
    const audit = new AuditService(
      { manager } as never,
      new AuditRedactionService(),
      new RequestContext(),
    );
    const record = () =>
      audit.record(
        {
          domain: AuditEventDomain.IDENTITY,
          event: 'identity.test_action',
          actorType: 'user',
          actorId: 'actor',
          source: 'http',
          metadata: {},
        },
        manager as never,
      );
    const scope = { actorId: 'actor', operation: 'test', route: 'POST /test' };
    const work = async () => {
      await Promise.resolve();
      await record();
      return { status: 204, body: null };
    };
    await Promise.all(
      ['first', 'second'].map((key) =>
        idempotency.execute(scope, key, 'fp', work),
      ),
    );
    await idempotency.execute(scope, 'first', 'fp', work);
    await record();
    const keys = manager.create.mock.calls.map(
      (call) => (call[1] as { idempotency_key: string | null }).idempotency_key,
    );
    expect(keys.slice(0, 2).sort()).toEqual(['first', 'second']);
    expect(keys).toHaveLength(3);
    expect(keys[2]).toBeNull();
    idempotency.onModuleDestroy();
  });
});
