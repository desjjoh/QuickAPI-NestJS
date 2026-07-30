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
    domain: 'identity',
    outcome: 'succeeded' as const,
    actorType: 'user' as const,
    actorId: 'user-1',
    subjectType: 'user',
    subjectId: 'user-1',
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
        domain: 'identity',
        actor_type: 'user',
        actor_id: 'user-1',
        subject_type: 'user',
        subject_id: 'user-1',
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
      resourceType: 'profile',
      resourceId: 'profile-1',
      before: { name: { first: 'Old' }, phone: '111', password: 'secret' },
      after: { name: { first: 'New' }, phone: '222', password: 'changed' },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'entity_change',
        before: { name: { first: 'Old' } },
        after: { name: { first: 'New' } },
        changes: {
          name: {
            first: { before: 'Old', after: 'New' },
          },
        },
      }),
    );
  });

  it('recursively excludes known credentials, codes, and tokens from every stored payload', async () => {
    const secrets = [
      'KnownPassword!23',
      '$2b$12$known-password-hash',
      '123456',
      'known-verification-token',
      'known-refresh-token',
      'known-mfa-secret',
    ];

    await service.recordActivity({
      ...activity,
      metadata: {
        password: secrets[0],
        verification_code: secrets[2],
        refresh_token: secrets[4],
        mfa_secret: secrets[5],
      },
    });
    await service.recordEntityChange({
      ...activity,
      event: 'identity.password.changed',
      resourceType: 'user',
      resourceId: 'user-1',
      before: {
        id: 'user-1',
        sessions: [{ id: 'session-1', refresh: secrets[4] }],
      },
      after: {
        id: 'user-1',
        identity: { password: secrets[0] },
        sessions: [{ id: 'session-2', refresh: secrets[4] }],
      },
    });

    for (const [stored] of repository.insert.mock.calls) {
      const serialized = JSON.stringify(stored);
      for (const secret of secrets) expect(serialized).not.toContain(secret);
    }
  });

  it('does not persist an entity record without a meaningful safe change', async () => {
    const result = await service.recordEntityChange({
      ...activity,
      event: 'entity.update',
      resourceType: 'user',
      resourceId: 'user-1',
      before: { id: 'user-1', roles: ['role-2', 'role-1'] },
      after: { id: 'user-1', roles: ['role-1', 'role-2'] },
    });

    expect(result).toBeNull();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['event', { event: '' }],
    ['domain', { domain: '' }],
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
    await new Promise<void>((resolve, reject) => {
      context.run(
        {
          requestId: 'request-1',
          method: 'post',
          path: '/api/users/:id',
          ip: '127.0.0.1',
          userId: 'context-user',
          sessionId: 'session-1',
          userAgent: 'test-agent',
          actorType: 'user',
          source: 'http',
          route: '/api/users/:id',
        },
        () => {
          service
            .recordActivity({ ...activity, actorId: undefined })
            .then(() => resolve())
            .catch(reject);
        },
      );
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: 'context-user',
        actor_id: 'context-user',
        session_id: 'session-1',
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        http_method: 'POST',
        route: '/api/users/:id',
      }),
    );
  });

  it('prefers explicit audit input over active context values', async () => {
    await context.run(
      {
        requestId: 'context-request',
        sessionId: 'context-session',
        userId: 'context-user',
        actorType: 'anonymous',
        source: 'queue',
        route: '/context/:id',
      },
      () =>
        service.recordActivity({
          ...activity,
          requestId: 'explicit-request',
          sessionId: 'explicit-session',
          actorId: 'explicit-user',
          actorType: 'admin',
          source: 'system',
          route: '/explicit/:id',
        }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: 'explicit-request',
        session_id: 'explicit-session',
        actor_user_id: 'explicit-user',
        actor_id: 'explicit-user',
        source: 'system',
        route: '/explicit/:id',
      }),
    );
  });

  it('normalizes relation objects to a stable, unique ID list', async () => {
    await service.recordEntityChange({
      ...activity,
      event: 'entity.update',
      resourceType: 'user',
      resourceId: 'user-1',
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
