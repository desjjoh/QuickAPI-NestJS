import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';

import { RequestContext } from '@/common/store/request-context.store';
import { ActivityAuditEntity } from '../entities/activity-audit.entity';
import { ActivityAuditService } from './activity-audit.service';
import { AuditRedactionService } from './audit-redaction.service';

describe(ActivityAuditService.name, () => {
  let repository: {
    create: jest.Mock;
    insert: jest.Mock;
  };
  let redaction: AuditRedactionService;
  let context: RequestContext;
  let service: ActivityAuditService;

  const activity = {
    event: 'identity.sign_in.succeeded',
    outcome: 'succeeded' as const,
    actorType: 'user' as const,
    actorUserId: 'user-1',
    subjectUserId: 'user-1',
    source: 'http' as const,
    metadata: { reason: 'interactive', ignored: 'not retained' },
  };

  beforeEach(() => {
    repository = {
      create: jest.fn((value) => value as ActivityAuditEntity),
      insert: jest
        .fn()
        .mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] }),
    };
    redaction = new AuditRedactionService();
    context = new RequestContext();
    service = new ActivityAuditService(
      repository as unknown as Repository<ActivityAuditEntity>,
      redaction,
      context,
    );
  });

  it('records an explicitly supplied activity after redacting metadata', async () => {
    const result = await service.recordActivity(activity);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'activity_event',
        event: activity.event,
        actor_user_id: 'user-1',
        metadata: { reason: 'interactive' },
        before: null,
        after: null,
        changes: null,
      }),
    );
    expect(repository.insert).toHaveBeenCalledWith(result);
  });

  it('records safe snapshots and a field-level entity change', async () => {
    await service.recordEntityChange({
      ...activity,
      event: 'entity.update',
      entityType: 'profile',
      entityId: 'profile-1',
      before: { name: { first: 'Old' }, phone: '111', password: 'secret' },
      after: { name: { first: 'New' }, phone: '222', password: 'changed' },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'entity_change',
        before: { name: { first: 'Old' }, phone: '[CHANGED]' },
        after: { name: { first: 'New' }, phone: '[CHANGED]' },
        changes: {
          name: {
            before: { first: 'Old' },
            after: { first: 'New' },
          },
        },
      }),
    );
  });

  it.each([
    ['event', { event: '' }],
    ['outcome', { outcome: undefined }],
    ['actorType', { actorType: undefined }],
    ['source', { source: undefined }],
    ['metadata', { metadata: undefined }],
  ])('rejects a missing %s', (_name, override) => {
    expect(() =>
      service.recordActivity({ ...activity, ...override } as never),
    ).toThrow(BadRequestException);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('enriches an activity from the active request context', async () => {
    const request = {
      headers: { 'user-agent': 'test-agent' },
      user: { sessionEntity: { id: 'session-1' } },
    } as never;

    await new Promise<void>((resolve, reject) => {
      context.run(
        {
          request,
          requestId: 'request-1',
          method: 'post',
          path: '/api/users/:id',
          ip: '127.0.0.1',
          userId: 'context-user',
        },
        () => {
          service
            .recordActivity({ ...activity, actorUserId: undefined })
            .then(() => resolve())
            .catch(reject);
        },
      );
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: 'context-user',
        request_id: 'request-1',
        session_id: 'session-1',
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        http_method: 'POST',
        route: '/api/users/:id',
      }),
    );
  });

  it('normalizes relation objects to a stable, unique ID list', async () => {
    await service.recordEntityChange({
      ...activity,
      event: 'entity.update',
      entityType: 'user',
      entityId: 'user-1',
      before: { roles: [{ id: 'role-b' }, { id: 'role-a' }] },
      after: { roles: ['role-c', 'role-a', 'role-c'] },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        before: { roles: ['role-a', 'role-b'] },
        after: { roles: ['role-a', 'role-c'] },
      }),
    );
  });

  it('uses the transaction manager repository when supplied', async () => {
    const transactionRepository = {
      create: jest.fn((value) => value as ActivityAuditEntity),
      insert: jest.fn().mockResolvedValue({}),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(transactionRepository),
    } as unknown as EntityManager;

    await service.recordActivity(activity, manager);

    expect(manager.getRepository).toHaveBeenCalledWith(ActivityAuditEntity);
    expect(transactionRepository.insert).toHaveBeenCalledTimes(1);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('propagates repository failures to the caller', async () => {
    repository.insert.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.recordActivity(activity)).rejects.toThrow(
      'database unavailable',
    );
  });

  it('rejects a payload that remains oversized after redaction', async () => {
    jest.spyOn(redaction, 'redactMetadata').mockReturnValue({
      reason: 'x'.repeat(70_000),
    });
    await expect(service.recordActivity(activity)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });
});
