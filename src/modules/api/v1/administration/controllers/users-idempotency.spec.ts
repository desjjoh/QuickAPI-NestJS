import {
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import { IdempotencyInterceptor } from '@/common/interceptors/idempotency.interceptor';
import { sanitizeHeadersMiddleware } from '@/common/middleware/header-sanitization.middleware';
import { IdempotencyService } from '@/modules/system/idempotency/services/idempotency.service';
import { idempotencyTestStore } from '../../../../../../test/helpers/idempotency-test-store';
import { UserAdministrationController } from './users.controller';
import { UserAdminService } from '../service/users.service';
import { UserActivityAdminService } from '../service/user-activity.service';

describe('user administration idempotency HTTP contracts', () => {
  let app: INestApplication;
  let permitted = true;
  let deleted = false;
  let status = 'active';
  const id = '1234567890ABCDEF';
  const store = idempotencyTestStore();
  const service = {
    updateUser: jest.fn(
      async (userId: string, body: { status_id?: string }) => {
        status = body.status_id ?? status;
        return { id: userId, status };
      },
    ),
    removeUser: jest.fn(async () => {
      if (deleted) throw new NotFoundException();
      deleted = true;
    }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserAdministrationController],
      providers: [
        IdempotencyInterceptor,
        { provide: UserAdminService, useValue: service },
        { provide: UserActivityAdminService, useValue: {} },
        {
          provide: IdempotencyService,
          useValue: new IdempotencyService(store.repository),
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          if (!req.headers.authorization) throw new UnauthorizedException();
          req.user = { userEntity: { id: req.headers.authorization } };
          return true;
        },
      })
      .overrideGuard(PermissionsGuard)
      .useValue({
        canActivate: () => {
          if (!permitted) throw new ForbiddenException();
          return true;
        },
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    app.use(sanitizeHeadersMiddleware());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    store.rows.clear();
    permitted = true;
    deleted = false;
    status = 'active';
  });
  afterAll(async () => {
    await app?.close();
  });
  const update = (
    key: string,
    body = { status_id: 'DISABLED12345678', reason_code: 'policy_enforcement' },
    actor = 'admin',
  ) =>
    request(app.getHttpServer())
      .patch(`/users/${id}`)
      .set('Authorization', actor)
      .set('Idempotency-Key', key)
      .send(body);
  const remove = () =>
    request(app.getHttpServer())
      .post(`/users/${id}/delete`)
      .set('Authorization', 'admin')
      .set('Idempotency-Key', 'remove')
      .send({ reason_code: 'user_request' });

  it('replays the original update without overwriting a later, distinct action', async () => {
    const original = await update('first').expect(200);
    const newer = {
      status_id: 'ACTIVE1234567890',
      reason_code: 'access_review',
    };
    await update('newer', newer).expect(200);
    expect((await update('first').expect(200)).body).toEqual(original.body);
    expect(status).toBe(newer.status_id);
    expect(service.updateUser).toHaveBeenCalledTimes(2);
    await update('first', newer).expect(409);
  });
  it('replays deletion as bodyless 204 without looking up the removed user again', async () => {
    for (let attempt = 0; attempt < 2; attempt++)
      expect((await remove().expect(204)).text).toBe('');
    expect(service.removeUser).toHaveBeenCalledTimes(1);
    await request(app.getHttpServer())
      .post(`/users/${id}/delete`)
      .set('Authorization', 'admin')
      .set('Idempotency-Key', 'remove')
      .send({ reason_code: 'policy_enforcement' })
      .expect(409);
    expect(service.removeUser).toHaveBeenCalledTimes(1);
  });
  it('isolates actor scopes and still checks permissions and authentication before replay', async () => {
    await update('key').expect(200);
    await update('key', undefined, 'other-admin').expect(200);
    await request(app.getHttpServer())
      .patch(`/users/${id}`)
      .set('Idempotency-Key', 'key')
      .send({ reason_code: 'access_review' })
      .expect(401);
    permitted = false;
    await update('key').expect(403);
    expect(service.updateUser).toHaveBeenCalledTimes(2);
  });
  it('does not retain invalid requests and leaves unkeyed actions unchanged', async () => {
    await update('invalid', {
      status_id: 'bad',
      reason_code: 'policy_enforcement',
    }).expect(400);
    expect(store.rows.size).toBe(0);
    for (let attempt = 0; attempt < 2; attempt++)
      await request(app.getHttpServer())
        .patch(`/users/${id}`)
        .set('Authorization', 'admin')
        .send({ reason_code: 'access_review' })
        .expect(200);
    expect(service.updateUser).toHaveBeenCalledTimes(2);
    expect(store.rows.size).toBe(0);
  });
});
