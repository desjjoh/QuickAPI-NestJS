import type { INestApplication } from '@nestjs/common';
import { getOptionsToken } from '@nestjs/throttler';
import request from 'supertest';
import { jest } from '@jest/globals';

import { RequestContext } from '@/common/store/request-context.store';

import {
  AuditActorType,
  AuditSource,
  AuditSubjectType,
  IdentityAuditEvents,
} from '@/config/audit-events.config';

import { PermissionEntity } from '@/modules/domain/library/entities/permission.entity';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';
import { AccountStatusEntity } from '@/modules/domain/library/entities/accountstatus.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { ImageEntity } from '@/modules/domain/media/entities/image.entity';
import { IdempotencyEntity } from '@/modules/system/idempotency/entities/idempotency.entity';
import {
  StorageService,
  PutStorageObjectInput,
} from '@/modules/system/storage/types/storage.types';
import { AuditEventEntity } from '@/modules/domain/audit/entities/audit-event.entity';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import { UserAdministrationService } from '@/modules/domain/identity/services/user-administration.service';
import { UserAdminService } from '@/modules/api/v1/administration/service/users.service';
import { EmailService } from '@/modules/system/email/services/email.service';

import {
  acquireCsrf,
  CapturingEmailService,
  registrationPayload,
  REGISTRATION_ROOT,
} from '../authentication/authentication-e2e.helpers';
import {
  setupTestSuite,
  teardownTestSuite,
  TestSuite,
} from '../../helpers/test-app';

const ROOT = '/api/v1/administration/users';
type Auth = { authorization: string };

class MemoryStorage extends StorageService {
  public readonly objects = new Map<string, Buffer>();
  public async putObject(input: PutStorageObjectInput) {
    this.objects.set(input.key, Buffer.from(input.body));
    return {
      key: input.key,
      url: `memory://${input.key}`,
      contentType: input.contentType,
      sizeBytes: Buffer.byteLength(input.body),
    };
  }
  public async deleteObject({ key }: { key: string }): Promise<void> {
    this.objects.delete(key);
  }
  public async objectExists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }
}

describe('user administration authorization and lifecycle', () => {
  let suite: TestSuite;
  let app: INestApplication;
  let email: CapturingEmailService;
  let storage: MemoryStorage;

  beforeAll(async () => {
    email = new CapturingEmailService();
    storage = new MemoryStorage();
    suite = await setupTestSuite((builder) =>
      builder
        .overrideProvider(EmailService)
        .useValue(email)
        .overrideProvider(StorageService)
        .useValue(storage)
        .overrideProvider(getOptionsToken())
        .useValue({
          skipIf: () => true,
          throttlers: [{ name: 'default', limit: 1, ttl: 60_000 }],
        }),
    );
    app = suite.app;
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    storage.objects.clear();
    email.clear();
    await suite.resetDatabase();
  });
  afterAll(async () => teardownTestSuite(suite));

  async function register(address: string): Promise<UserEntity> {
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const pending = await agent
      .post(`${REGISTRATION_ROOT}/request`)
      .set('x-csrf-token', csrf)
      .send({
        ...(await registrationPayload(suite.dataSource)),
        email: address,
      })
      .expect(201);
    const challenge = pending.body.challenge_id as string;
    await agent
      .post(`${REGISTRATION_ROOT}/confirm`)
      .set('x-csrf-token', csrf)
      .send({
        challenge_id: challenge,
        code: email.verificationCodeFor(challenge),
      })
      .expect(200);
    return suite.dataSource
      .getRepository(UserEntity)
      .findOneOrFail({ where: { identity: { email: address } } });
  }

  async function grant(
    user: UserEntity,
    roleKey: string,
    permissionKeys: string[],
  ) {
    const permissions = permissionKeys.length
      ? await suite.dataSource
          .getRepository(PermissionEntity)
          .createQueryBuilder('permission')
          .where('permission.key IN (:...keys)', { keys: permissionKeys })
          .getMany()
      : [];
    expect(permissions).toHaveLength(permissionKeys.length);
    const role = await suite.dataSource.getRepository(RoleEntity).save(
      suite.dataSource.getRepository(RoleEntity).create({
        key: roleKey,
        label: roleKey,
        description: 'E2E only',
        permissions,
      }),
    );
    await suite.dataSource
      .createQueryBuilder()
      .relation(UserEntity, 'roles')
      .of(user.id)
      .add(role.id);
    return role;
  }

  async function signIn(address: string): Promise<Auth> {
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const response = await agent
      .post('/api/v1/authentication/sign-in')
      .set('x-csrf-token', csrf)
      .send({ email: address, password: 'Valid!Pass1' })
      .expect(201);
    return { authorization: `Bearer ${response.body.access_token as string}` };
  }

  it('distinguishes missing authentication from insufficient permissions', async () => {
    const none = await register('none@example.test');
    const unrelated = await register('unrelated@example.test');
    await grant(none, 'e2e-none', []);
    await grant(unrelated, 'e2e-unrelated', ['update_account']);
    await suite.dataSource.getRepository(UserSessionEntity).clear();

    await request(app.getHttpServer()).get(ROOT).expect(401);
    await request(app.getHttpServer())
      .get(ROOT)
      .set(await signIn('none@example.test'))
      .expect(403);
    await request(app.getHttpServer())
      .get(ROOT)
      .set(await signIn('unrelated@example.test'))
      .expect(403);
  });

  it('allows the exact read permission to list and inspect users', async () => {
    const reader = await register('reader@example.test');
    const target = await register('target@example.test');
    await grant(reader, 'e2e-reader', ['read_users']);
    await suite.dataSource.getRepository(UserSessionEntity).clear();
    const auth = await signIn('reader@example.test');
    const list = await request(app.getHttpServer())
      .get(ROOT)
      .set(auth)
      .expect(200);
    expect(list.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: target.id })]),
    );
    const detail = await request(app.getHttpServer())
      .get(`${ROOT}/${target.id}`)
      .set(auth)
      .expect(200);
    expect(detail.body).toMatchObject({
      id: target.id,
      identity: { email: 'target@example.test' },
    });
    await request(app.getHttpServer())
      .patch(`${ROOT}/${target.id}`)
      .set(auth)
      .send({ role_ids: [], reason_code: 'access_review' })
      .expect(403);
  });
  it('allows only update_users (or all permissions) to update users', async () => {
    const updater = await register('updater@example.test');
    const reader = await register('update-reader@example.test');
    const superuser = await register('all@example.test');
    const target = await register('target@example.test');
    const assigned = await grant(target, 'e2e-target-role', []);
    await grant(updater, 'e2e-updater', ['update_users']);
    await grant(reader, 'e2e-update-reader', ['read_users']);
    await grant(superuser, 'e2e-all', ['has_all_permissions']);
    await suite.dataSource.getRepository(UserSessionEntity).clear();
    const disabled = await suite.dataSource
      .getRepository(AccountStatusEntity)
      .findOneByOrFail({ key: 'disabled' });
    await request(app.getHttpServer())
      .patch(`${ROOT}/${target.id}`)
      .send({ status_id: disabled.id, reason_code: 'policy_enforcement' })
      .expect(401);
    await request(app.getHttpServer())
      .patch(`${ROOT}/${target.id}`)
      .set(await signIn('update-reader@example.test'))
      .send({ status_id: disabled.id, reason_code: 'policy_enforcement' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`${ROOT}/${target.id}`)
      .set(await signIn('updater@example.test'))
      .send({ status_id: disabled.id })
      .expect(422);
    const updated = await request(app.getHttpServer())
      .patch(`${ROOT}/${target.id}`)
      .set(await signIn('updater@example.test'))
      .send({
        status_id: disabled.id,
        role_ids: [],
        reason_code: 'policy_enforcement',
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      status: { key: 'disabled' },
      roles: [],
    });
    expect(updated.body.roles).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: assigned.id })]),
    );
    await request(app.getHttpServer())
      .get(`${ROOT}/${target.id}`)
      .set(await signIn('all@example.test'))
      .expect(200);
  });

  it('enforces delete_users and deletes the selected account', async () => {
    const reader = await register('reader@example.test');
    const deleter = await register('deleter@example.test');
    const target = await register('target@example.test');
    await grant(reader, 'e2e-delete-reader', ['read_users']);
    await grant(deleter, 'e2e-deleter', ['delete_users']);
    await suite.dataSource.getRepository(UserSessionEntity).clear();
    await request(app.getHttpServer())
      .post(`${ROOT}/${target.id}/delete`)
      .send({ reason_code: 'user_request' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`${ROOT}/${target.id}/delete`)
      .set(await signIn('reader@example.test'))
      .send({ reason_code: 'user_request' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`${ROOT}/${target.id}/delete`)
      .set(await signIn('deleter@example.test'))
      .send({})
      .expect(422);
    await request(app.getHttpServer())
      .post(`${ROOT}/${target.id}/delete`)
      .set(await signIn('deleter@example.test'))
      .send({ reason_code: 'user_request' })
      .expect(204);
    expect(
      await suite.dataSource
        .getRepository(UserEntity)
        .findOneBy({ id: target.id }),
    ).toBeNull();
  });

  it('replays keyed updates without reapplying an older action over a newer one', async () => {
    const admin = await register('idempotent-admin@example.test');
    const target = await register('idempotent-target@example.test');
    const other = await register('idempotent-other@example.test');
    await grant(admin, 'e2e-idempotent-update', ['update_users']);
    const auth = await signIn('idempotent-admin@example.test');
    const disabled = await suite.dataSource
      .getRepository(AccountStatusEntity)
      .findOneByOrFail({ key: 'disabled' });
    const payload = {
      status_id: disabled.id,
      role_ids: [],
      reason_code: 'policy_enforcement',
    };
    const update = (id = target.id, body = payload, key = 'update') =>
      request(app.getHttpServer())
        .patch(`${ROOT}/${id}`)
        .set(auth)
        .set('Idempotency-Key', key)
        .send(body);
    const first = await update().expect(200);
    expect((await update().expect(200)).body).toEqual(first.body);
    const newer = {
      ...payload,
      status_id: target.status.id,
      reason_code: 'access_review',
    };
    await update(target.id, newer, 'new-action').expect(200);
    expect((await update().expect(200)).body).toEqual(first.body);
    expect(
      (
        await suite.dataSource
          .getRepository(UserEntity)
          .findOneByOrFail({ id: target.id })
      ).status.id,
    ).toBe(target.status.id);
    await update(target.id, newer).expect(409);
    // Same actor/key is independent for a different target route.
    await update(other.id).expect(200);
    expect(
      await suite.dataSource.getRepository(AuditEventEntity).count({
        where: {
          event: IdentityAuditEvents.ADMIN_USER_UPDATED,
          resource_id: target.id,
        },
      }),
    ).toBe(2);
    expect(
      await suite.dataSource.getRepository(IdempotencyEntity).count(),
    ).toBe(3);
  });

  it('executes concurrent keyed updates only once and checks permissions again on replay', async () => {
    const admin = await register('concurrent-admin@example.test');
    const target = await register('concurrent-target@example.test');
    const role = await grant(admin, 'e2e-idempotent-concurrent', [
      'update_users',
    ]);
    const auth = await signIn('concurrent-admin@example.test');
    const update = () =>
      request(app.getHttpServer())
        .patch(`${ROOT}/${target.id}`)
        .set(auth)
        .set('Idempotency-Key', 'concurrent')
        .send({ role_ids: [], reason_code: 'access_review' });
    const responses = await Promise.all([update(), update()]);
    expect(
      responses.every((response) => [200, 409].includes(response.status)),
    ).toBe(true);
    const winner = responses.find((response) => response.status === 200);
    expect(winner).toBeDefined();
    expect((await update().expect(200)).body).toEqual(winner!.body);
    expect(
      await suite.dataSource.getRepository(AuditEventEntity).count({
        where: {
          event: IdentityAuditEvents.ADMIN_USER_UPDATED,
          resource_id: target.id,
        },
      }),
    ).toBe(1);
    await suite.dataSource
      .createQueryBuilder()
      .relation(UserEntity, 'roles')
      .of(admin.id)
      .remove(role.id);
    await update().expect(403);
  });

  async function assignAvatar(target: UserEntity) {
    const key = `avatars/${target.id}.png`;
    storage.objects.set(key, Buffer.from('fixture'));
    const image = await suite.dataSource.getRepository(ImageEntity).save(
      suite.dataSource.getRepository(ImageEntity).create({
        storage_key: key,
        filename: 'avatar.png',
        mime_type: 'image/png',
        size_bytes: 7,
        width: 1,
        height: 1,
      }),
    );
    await app
      .get(UserService)
      .updateUser(target, { profile: { media: { avatar: { id: image.id } } } });
    return { key, image };
  }

  it('replays concurrent deletion as bodyless 204 with one retained audit and one storage cleanup', async () => {
    const admin = await register('delete-replay-admin@example.test');
    const target = await register('delete-replay-target@example.test');
    await grant(admin, 'e2e-idempotent-delete', ['delete_users']);
    const auth = await signIn('delete-replay-admin@example.test');
    const { key, image } = await assignAvatar(target);
    const cleanup = jest.spyOn(storage, 'deleteObject');
    const remove = () =>
      request(app.getHttpServer())
        .post(`${ROOT}/${target.id}/delete`)
        .set(auth)
        .set('Idempotency-Key', 'delete')
        .send({ reason_code: 'user_request' });
    const responses = await Promise.all([remove(), remove()]);
    expect(
      responses.every((response) => [204, 409].includes(response.status)),
    ).toBe(true);
    expect(responses.some((response) => response.status === 204)).toBe(true);
    expect((await remove().expect(204)).text).toBe('');
    expect(
      await suite.dataSource
        .getRepository(UserEntity)
        .findOneBy({ id: target.id }),
    ).toBeNull();
    expect(
      await suite.dataSource
        .getRepository(ImageEntity)
        .findOneBy({ id: image.id }),
    ).toBeNull();
    expect(storage.objects.has(key)).toBe(false);
    expect(cleanup).toHaveBeenCalledTimes(1);
    const events = await suite.dataSource
      .getRepository(AuditEventEntity)
      .findBy({
        event: IdentityAuditEvents.ADMIN_USER_DELETED,
        resource_id: target.id,
      });
    expect(events).toHaveLength(1);
    expect(events[0].before).toMatchObject({ id: target.id });
    expect(events[0].actor_id).toBe(admin.id);
    const record = await suite.dataSource
      .getRepository(IdempotencyEntity)
      .findOneByOrFail({ operation: 'identity.administration.user.delete' });
    expect(record.response_status).toBe(204);
    expect(record.response_body).toBeNull();
    await request(app.getHttpServer())
      .post(`${ROOT}/${target.id}/delete`)
      .set(auth)
      .set('Idempotency-Key', 'delete')
      .send({ reason_code: 'policy_enforcement' })
      .expect(409);
  });

  it('rolls back keyed deletion and preserves storage when audit persistence fails', async () => {
    const admin = await register('delete-rollback-admin@example.test');
    const target = await register('delete-rollback-target@example.test');
    await grant(admin, 'e2e-idempotent-delete-rollback', ['delete_users']);
    const auth = await signIn('delete-rollback-admin@example.test');
    const { key, image } = await assignAvatar(target);
    const cleanup = jest.spyOn(storage, 'deleteObject');
    const audit = jest
      .spyOn(app.get(AuditService), 'record')
      .mockRejectedValueOnce(new Error('audit failed'));
    const remove = () =>
      request(app.getHttpServer())
        .post(`${ROOT}/${target.id}/delete`)
        .set(auth)
        .set('Idempotency-Key', 'rollback')
        .send({ reason_code: 'user_request' });
    await remove().expect(500);
    audit.mockRestore();
    expect(
      await suite.dataSource
        .getRepository(UserEntity)
        .findOneBy({ id: target.id }),
    ).not.toBeNull();
    expect(
      await suite.dataSource
        .getRepository(ImageEntity)
        .findOneBy({ id: image.id }),
    ).not.toBeNull();
    expect(storage.objects.has(key)).toBe(true);
    expect(cleanup).not.toHaveBeenCalled();
    expect(
      await suite.dataSource.getRepository(IdempotencyEntity).count(),
    ).toBe(0);
    expect(
      await suite.dataSource.getRepository(AuditEventEntity).count({
        where: {
          event: IdentityAuditEvents.ADMIN_USER_DELETED,
          resource_id: target.id,
        },
      }),
    ).toBe(0);
    await remove().expect(204);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('commits an administrative write and its success audit together', async () => {
    const updater = await register('audit-commit-admin@example.test');
    const target = await register('audit-commit-target@example.test');
    await grant(updater, 'e2e-audit-commit', [
      'update_users',
      'read_audit_detail',
    ]);
    await suite.dataSource.getRepository(UserSessionEntity).clear();
    const disabled = await suite.dataSource
      .getRepository(AccountStatusEntity)
      .findOneByOrFail({ key: 'disabled' });

    await request(app.getHttpServer())
      .patch(`${ROOT}/${target.id}`)
      .set(await signIn('audit-commit-admin@example.test'))
      .send({ status_id: disabled.id, reason_code: 'policy_enforcement' })
      .expect(200);

    const event = await suite.dataSource
      .getRepository(AuditEventEntity)
      .findOneByOrFail({
        event: IdentityAuditEvents.ADMIN_USER_UPDATED,
        resource_id: target.id,
      });
    expect(event.before).not.toEqual(event.after);
    expect(event.metadata).toEqual({ reason_code: 'policy_enforcement' });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/administration/audits/${event.id}`)
      .set(await signIn('audit-commit-admin@example.test'))
      .expect(200);
    expect(detail.body).toMatchObject({
      reasonCode: 'policy_enforcement',
      before: {
        status: { id: target.status.id },
      },
      after: {
        status: { id: disabled.id },
      },
    });
    expect(detail.body.metadata).toEqual({
      reason_code: 'policy_enforcement',
    });
    expect(JSON.stringify(detail.body)).not.toMatch(/password|authorization/);
  });

  it('rolls back the domain write without recording a success event', async () => {
    const updater = await register('audit-rollback-admin@example.test');
    const target = await register('audit-rollback-target@example.test');
    await grant(updater, 'e2e-audit-rollback', ['update_users']);
    await suite.dataSource.getRepository(UserSessionEntity).clear();
    const disabled = await suite.dataSource
      .getRepository(AccountStatusEntity)
      .findOneByOrFail({ key: 'disabled' });
    const originalStatus = target.status.id;
    const userAdministration = app.get(UserAdministrationService);
    const implementation =
      userAdministration.updateAdministration.bind(userAdministration);
    const mutation = jest
      .spyOn(userAdministration, 'updateAdministration')
      .mockImplementation(async (...args) => {
        await implementation(...args);
        throw new Error('failure after domain write');
      });

    await request(app.getHttpServer())
      .patch(`${ROOT}/${target.id}`)
      .set(await signIn('audit-rollback-admin@example.test'))
      .set('Idempotency-Key', 'failed-domain-update')
      .send({ status_id: disabled.id, reason_code: 'policy_enforcement' })
      .expect(500);
    mutation.mockRestore();

    const stored = await suite.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: target.id });
    expect(stored.status.id).toBe(originalStatus);
    expect(
      await suite.dataSource.getRepository(IdempotencyEntity).count(),
    ).toBe(0);
    expect(
      await suite.dataSource.getRepository(AuditEventEntity).existsBy({
        event: IdentityAuditEvents.ADMIN_USER_UPDATED,
        resource_id: target.id,
      }),
    ).toBe(false);
  });

  it('rolls back a security-sensitive mutation when its success audit insert fails', async () => {
    const updater = await register('audit-failure-admin@example.test');
    const target = await register('audit-failure-target@example.test');
    await grant(updater, 'e2e-audit-failure', ['update_users']);
    await suite.dataSource.getRepository(UserSessionEntity).clear();
    const disabled = await suite.dataSource
      .getRepository(AccountStatusEntity)
      .findOneByOrFail({ key: 'disabled' });
    const originalStatus = target.status.id;
    const audit = app.get(AuditService);
    const implementation = audit.record.bind(audit);
    const insertion = jest
      .spyOn(audit, 'record')
      .mockImplementation((input, manager) => {
        if (manager)
          return Promise.reject(new Error('simulated audit insert failure'));
        return implementation(input, manager);
      });

    await request(app.getHttpServer())
      .patch(`${ROOT}/${target.id}`)
      .set(await signIn('audit-failure-admin@example.test'))
      .set('Idempotency-Key', 'failed-audit-update')
      .send({ status_id: disabled.id, reason_code: 'policy_enforcement' })
      .expect(500);
    insertion.mockRestore();

    const stored = await suite.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: target.id });
    expect(stored.status.id).toBe(originalStatus);
    expect(
      await suite.dataSource.getRepository(IdempotencyEntity).count(),
    ).toBe(0);
    expect(
      await suite.dataSource.getRepository(AuditEventEntity).existsBy({
        event: IdentityAuditEvents.ADMIN_USER_UPDATED,
        resource_id: target.id,
      }),
    ).toBe(false);
  });

  it('allows retry of a keyed update after audit rollback', async () => {
    const admin = await register('update-safe-retry-admin@example.test');
    const target = await register('update-safe-retry-target@example.test');
    await grant(admin, 'e2e-update-safe-retry', ['update_users']);
    const auth = await signIn('update-safe-retry-admin@example.test');
    const disabled = await suite.dataSource
      .getRepository(AccountStatusEntity)
      .findOneByOrFail({ key: 'disabled' });
    const update = () =>
      request(app.getHttpServer())
        .patch(`${ROOT}/${target.id}`)
        .set(auth)
        .set('Idempotency-Key', 'safe-retry')
        .send({ status_id: disabled.id, reason_code: 'policy_enforcement' });
    jest
      .spyOn(app.get(AuditService), 'record')
      .mockRejectedValueOnce(new Error('failed audit'));
    await update().expect(500);
    expect(
      (
        await suite.dataSource
          .getRepository(UserEntity)
          .findOneByOrFail({ id: target.id })
      ).status.id,
    ).toBe(target.status.id);
    expect(
      await suite.dataSource.getRepository(IdempotencyEntity).count(),
    ).toBe(0);
    const retried = await update().expect(200);
    expect((await update().expect(200)).body).toEqual(retried.body);
    expect(
      await suite.dataSource.getRepository(AuditEventEntity).count({
        where: {
          event: IdentityAuditEvents.ADMIN_USER_UPDATED,
          resource_id: target.id,
        },
      }),
    ).toBe(1);
  });

  it('uses the request ID to correlate retries of an administrative mutation', async () => {
    const target = await register('audit-retry-target@example.test');
    const disabled = await suite.dataSource
      .getRepository(AccountStatusEntity)
      .findOneByOrFail({ key: 'disabled' });
    const service = app.get(UserAdminService);
    const context = app.get(RequestContext);
    const invoke = () =>
      context.run(
        {
          requestId: 'retry-operation',
          actorType: AuditActorType.ADMIN,
          source: AuditSource.SERVICE,
        },
        () =>
          service.updateUser(target.id, {
            status_id: disabled.id,
            reason_code: 'policy_enforcement',
          }),
      );

    await invoke();
    await invoke();

    expect(
      await suite.dataSource.getRepository(AuditEventEntity).countBy({
        event: IdentityAuditEvents.ADMIN_USER_UPDATED,
        request_id: 'retry-operation',
      }),
    ).toBe(1);
  });

  it('requires the dedicated permission and returns only activity for the route subject', async () => {
    const auditor = await register('activity-auditor@example.test');
    const ordinaryReader = await register('activity-reader@example.test');
    const target = await register('activity-target@example.test');
    const other = await register('activity-other@example.test');
    await grant(auditor, 'e2e-activity-auditor', [
      'read_administration_user_activity',
    ]);
    await grant(ordinaryReader, 'e2e-ordinary-reader', ['read_users']);
    await suite.dataSource.getRepository(UserSessionEntity).clear();

    await request(app.getHttpServer())
      .get(`${ROOT}/${target.id}/activity`)
      .set(await signIn('activity-reader@example.test'))
      .expect(403);

    const audit = app.get(AuditService);
    await audit.record({
      domain: 'identity',
      event: IdentityAuditEvents.PASSWORD_CHANGED,
      actorType: 'user',
      actorId: target.id,
      subjectType: AuditSubjectType.USER,
      subjectId: target.id,
      source: 'service',
      metadata: {},
      occurredAt: new Date('2026-04-03T00:00:00.000Z'),
    });
    await audit.record({
      domain: 'identity',
      event: IdentityAuditEvents.ADMIN_USER_UPDATED,
      actorType: 'admin',
      actorId: auditor.id,
      subjectType: AuditSubjectType.USER,
      subjectId: target.id,
      source: 'service',
      metadata: {},
      occurredAt: new Date('2026-04-02T00:00:00.000Z'),
    });
    await audit.record({
      domain: 'identity',
      event: IdentityAuditEvents.SESSION_REVOKED,
      actorType: 'user',
      actorId: other.id,
      subjectType: AuditSubjectType.USER,
      subjectId: other.id,
      source: 'service',
      metadata: {},
      occurredAt: new Date('2026-04-01T00:00:00.000Z'),
    });

    const response = await request(app.getHttpServer())
      .get(`${ROOT}/${target.id}/activity?actor=${auditor.id}`)
      .set(await signIn('activity-auditor@example.test'))
      .expect(200);
    expect(response.body).toEqual({
      data: [
        expect.objectContaining({
          event: IdentityAuditEvents.ADMIN_USER_UPDATED,
          actorType: 'admin',
          actorId: auditor.id,
          subjectType: AuditSubjectType.USER,
          subjectId: target.id,
        }),
      ],
      meta: {
        page: 1,
        take: 25,
        itemCount: 1,
        pageCount: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });
  });

  it('page-paginates a date-filtered user history and retains deletion activity', async () => {
    const auditor = await register('activity-delete-auditor@example.test');
    const target = await register('activity-delete-target@example.test');
    await grant(auditor, 'e2e-activity-delete-auditor', [
      'read_administration_user_activity',
      'delete_users',
    ]);
    await suite.dataSource.getRepository(UserSessionEntity).clear();
    const auth = await signIn('activity-delete-auditor@example.test');
    const audit = app.get(AuditService);
    for (const [event, occurredAt] of [
      [IdentityAuditEvents.MFA_ENABLED, '2026-05-03T00:00:00.000Z'],
      [IdentityAuditEvents.PASSWORD_CHANGED, '2026-05-02T00:00:00.000Z'],
    ] as const)
      await audit.record({
        domain: 'identity',
        event,
        actorType: 'user',
        actorId: target.id,
        subjectType: AuditSubjectType.USER,
        subjectId: target.id,
        source: 'service',
        metadata: {},
        occurredAt: new Date(occurredAt),
      });

    const first = await request(app.getHttpServer())
      .get(
        `${ROOT}/${target.id}/activity?take=1&occurredFrom=2026-05-01T00:00:00.000Z&occurredTo=2026-05-04T00:00:00.000Z`,
      )
      .set(auth)
      .expect(200);
    expect(first.body.data).toHaveLength(1);
    expect(first.body.meta).toEqual({
      page: 1,
      take: 1,
      itemCount: 2,
      pageCount: 2,
      hasPreviousPage: false,
      hasNextPage: true,
    });
    const second = await request(app.getHttpServer())
      .get(
        `${ROOT}/${target.id}/activity?page=2&take=1&occurredFrom=2026-05-01T00:00:00.000Z&occurredTo=2026-05-04T00:00:00.000Z`,
      )
      .set(auth)
      .expect(200);
    expect(second.body.data).toHaveLength(1);
    expect(second.body.data[0].id).not.toBe(first.body.data[0].id);
    expect(second.body.meta).toEqual({
      page: 2,
      take: 1,
      itemCount: 2,
      pageCount: 2,
      hasPreviousPage: true,
      hasNextPage: false,
    });

    await request(app.getHttpServer())
      .post(`${ROOT}/${target.id}/delete`)
      .set(auth)
      .send({ reason_code: 'user_request' })
      .expect(204);
    await expect(
      suite.dataSource.getRepository(UserEntity).findOneBy({ id: target.id }),
    ).resolves.toBeNull();
    const retained = await request(app.getHttpServer())
      .get(
        `${ROOT}/${target.id}/activity?event=${IdentityAuditEvents.ADMIN_USER_DELETED}`,
      )
      .set(auth)
      .expect(200);
    expect(retained.body.data).toEqual([
      expect.objectContaining({
        event: IdentityAuditEvents.ADMIN_USER_DELETED,
        subjectId: target.id,
      }),
    ]);
  });
});
