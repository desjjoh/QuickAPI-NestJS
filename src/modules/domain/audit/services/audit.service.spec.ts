import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';

import { RequestContext } from '@/common/store/request-context.store';
import { AuditEventDomain } from '@/config/audit-events.config';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { AuditService } from './audit.service';
import { AuditRedactionService } from './audit-redaction.service';

describe(AuditService.name, () => {
  let repository: {
    create: jest.Mock;
    insert: jest.Mock;
  };
  let redaction: AuditRedactionService;
  let context: RequestContext;
  let service: AuditService;

  const activity = {
    event: 'identity.sign_in.succeeded',
    domain: AuditEventDomain.IDENTITY,
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
      create: jest.fn((value) => value as AuditEventEntity),
      insert: jest
        .fn()
        .mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] }),
    };
    redaction = new AuditRedactionService();
    context = new RequestContext();
    service = new AuditService(
      repository as unknown as Repository<AuditEventEntity>,
      redaction,
      context,
    );
  });

  it('records an explicitly supplied activity after redacting metadata', async () => {
    const result = await service.record(activity);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        event: activity.event,
        domain: AuditEventDomain.IDENTITY,
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
    expect(result).not.toHaveProperty('category');
    expect(repository.insert).toHaveBeenCalledWith(result);
  });

  it('allows an unregistered resource type on events without snapshots', async () => {
    await service.record({
      ...activity,
      event: 'identity.external_resource.observed',
      resourceType: 'future.external_resource',
      resourceId: 'external-1',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: 'future.external_resource',
        resource_id: 'external-1',
        before: null,
        after: null,
      }),
    );
  });

  it('records a semantic event with safe snapshots and field-level changes', async () => {
    const result = await service.record({
      ...activity,
      event: 'identity.profile.updated',
      resourceType: 'identity.profile',
      resourceId: 'profile-1',
      before: { name: { first: 'Old' }, phone: '111', password: 'secret' },
      after: { name: { first: 'New' }, phone: '222', password: 'changed' },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        before: { name: { first: 'Old' } },
        after: { name: { first: 'New' } },
        changes: {
          name: {
            first: { before: 'Old', after: 'New' },
          },
        },
      }),
    );
    expect(result).not.toHaveProperty('category');
  });

  it('recursively redacts unified input across every JSON output column', async () => {
    const secrets = [
      'KnownPassword!23',
      '$2b$12$known-password-hash',
      '123456',
      'known-verification-token',
      'known-refresh-token',
      'known-mfa-secret',
      'known-cookie',
      'known-authorization',
      'known-request-body',
      'known-exception-detail',
      'known-postmark-key',
      'known-r2-secret',
      'known-crypto-key',
      'known-api-key',
    ];

    await service.record({
      ...activity,
      event: 'identity.user.updated',
      resourceType: 'identity.user',
      resourceId: 'user-1',
      metadata: {
        password: secrets[0],
        verification_code: secrets[2],
        refresh_token: secrets[4],
        mfa_secret: secrets[5],
        cookie: secrets[6],
        authorization: secrets[7],
        request_body: secrets[8],
        exception: secrets[9],
        postmark_api_key: secrets[10],
        r2_secret: secrets[11],
        encryption_key: secrets[12],
        api_credential: secrets[13],
        ip: '203.0.113.42',
        user_agent: 'private browser fingerprint',
      },
      before: {
        id: 'user-1',
        identity: { email: 'old@example.test', password: secrets[0] },
        metadata: { mfa_enabled: false, reset_code: secrets[2] },
        token_hash: secrets[1],
      },
      after: {
        id: 'user-1',
        identity: { email: 'new@example.test', password: secrets[1] },
        metadata: { mfa_enabled: true, verification_code: secrets[2] },
        access_token: secrets[3],
      },
      error: Object.assign(new Error(secrets[9]), {
        response: { body: secrets[8] },
        authorization: secrets[7],
      }),
    });

    const [stored] = repository.insert.mock.calls[0] as [AuditEventEntity];
    for (const column of [
      stored.before,
      stored.after,
      stored.changes,
      stored.metadata,
      stored.error,
    ]) {
      const serialized = JSON.stringify(column);
      for (const secret of secrets) expect(serialized).not.toContain(secret);
    }
    expect(stored.before).toEqual({
      identity: { email: 'o***@example.test' },
    });
    expect(stored.after).toEqual({
      identity: { email: 'n***@example.test' },
    });
    expect(stored.metadata).toMatchObject({
      ip: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      user_agent: '[CHANGED]',
    });
    expect(stored.error).toEqual({ type: 'Error', message: '[REDACTED]' });
  });

  it('does not persist an entity record without a meaningful safe change', async () => {
    const result = await service.record({
      ...activity,
      event: 'identity.user.roles_changed',
      resourceType: 'identity.user',
      resourceId: 'user-1',
      before: { id: 'user-1', roles: ['role-2', 'role-1'] },
      after: { id: 'user-1', roles: ['role-1', 'role-2'] },
    });

    expect(result).toBeNull();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('persists an explicitly meaningful event even when snapshots do not change', async () => {
    await service.record({
      ...activity,
      event: 'identity.profile.reviewed',
      resourceType: 'identity.profile',
      resourceId: 'profile-1',
      before: { name: { first: 'Same' } },
      after: { name: { first: 'Same' } },
      meaningfulWithoutChanges: true,
      operationId: 'operation-1',
      idempotencyId: 'retry-1',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        operation_id: 'operation-1',
        idempotency_id: 'retry-1',
        before: {},
        after: {},
        changes: {},
      }),
    );
  });

  it('rejects a lone snapshot and snapshots without a registered resource policy', () => {
    expect(() => service.record({ ...activity, before: {} })).toThrow(
      'before and after must be supplied together',
    );
    expect(() =>
      service.record({
        ...activity,
        resourceType: 'unregistered' as never,
        resourceId: 'resource-1',
        before: {},
        after: {},
      }),
    ).toThrow('resourceType has no registered snapshot policy');
  });

  it.each([
    ['event', { event: '' }],
    ['domain', { domain: '' }],
    ['actorType', { actorType: undefined }],
    ['source', { source: undefined }],
    ['metadata', { metadata: undefined }],
  ])('rejects a missing %s', (_name, override) => {
    expect(() => service.record({ ...activity, ...override } as never)).toThrow(
      BadRequestException,
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid domain format', { domain: 'Identity' }],
    ['invalid event format', { event: 'identity.profile-UPDATED' }],
    [
      'event outside the declared domain namespace',
      { event: 'store.product.updated' },
    ],
  ])('rejects %s', (_name, override) => {
    expect(() => service.record({ ...activity, ...override } as never)).toThrow(
      BadRequestException,
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('enriches an activity from the active request context', async () => {
    await new Promise<void>((resolve, reject) => {
      context.run(
        {
          requestId: 'request-1',
          method: 'post',
          ipAddress: '127.0.0.1',
          actorId: 'context-user',
          sessionId: 'session-1',
          userAgent: 'test-agent',
          actorType: 'user',
          source: 'http',
          normalizedRoute: '/api/users/:id',
        },
        () => {
          service
            .record({ ...activity, actorId: undefined })
            .then(() => resolve())
            .catch(reject);
        },
      );
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
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
        actorId: 'context-user',
        actorType: 'anonymous',
        source: 'queue',
        normalizedRoute: '/context/:id',
      },
      () =>
        service.record({
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
        actor_id: 'explicit-user',
        source: 'system',
        route: '/explicit/:id',
      }),
    );
  });

  it('allows an explicit null actor ID to override authenticated context', async () => {
    await context.run(
      {
        requestId: 'context-request',
        actorId: 'authenticated-user',
        actorType: 'user',
        source: 'http',
      },
      () =>
        service.record({
          ...activity,
          actorType: 'service',
          actorId: null,
          subjectType: 'user',
          subjectId: 'represented-user',
          source: 'service',
        }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_type: 'service',
        actor_id: null,
        subject_type: 'user',
        subject_id: 'represented-user',
        source: 'service',
      }),
    );
  });

  it('normalizes relation objects to a stable, unique ID list', async () => {
    await service.record({
      ...activity,
      event: 'identity.user.roles_changed',
      resourceType: 'identity.user',
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
      create: jest.fn((value) => value as AuditEventEntity),
      insert: jest.fn().mockResolvedValue({}),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(transactionRepository),
    } as unknown as EntityManager;

    await service.record(activity, manager);

    expect(manager.getRepository).toHaveBeenCalledWith(AuditEventEntity);
    expect(transactionRepository.insert).toHaveBeenCalledTimes(1);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('propagates repository failures to the caller', async () => {
    repository.insert.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.record(activity)).rejects.toThrow(
      'database unavailable',
    );
  });

  it('rejects a payload that remains oversized after redaction', async () => {
    jest.spyOn(redaction, 'redactMetadata').mockReturnValue({
      reason: 'x'.repeat(70_000),
    });
    await expect(service.record(activity)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });
});
