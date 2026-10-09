import {
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdir, readdir } from 'node:fs/promises';
import request from 'supertest';
import sharp from 'sharp';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import { IdempotencyInterceptor } from '@/common/interceptors/idempotency.interceptor';
import { sanitizeHeadersMiddleware } from '@/common/middleware/header-sanitization.middleware';
import { uploadTempRoot } from '@/config/storage.config';
import { IdempotencyService } from '@/modules/system/idempotency/services/idempotency.service';
import { idempotencyTestStore } from '../../../../../../test/helpers/idempotency-test-store';
import { ProfileApiController } from './profile.controller';
import { ProfileApiService } from '../services/profile.service';

describe('profile idempotency HTTP contracts', () => {
  let app: INestApplication;
  let png: Buffer;
  let filesBefore: string[];
  let permitted = true;
  const store = idempotencyTestStore();
  const service = {
    uploadAvatar: jest.fn(async () => ({ id: 'user', avatar: 'new-avatar' })),
    removeAvatar: jest.fn(async () => ({ id: 'user', avatar: null })),
    updatePhone: jest.fn(async () => ({ id: 'user', phone: 'new-phone' })),
    removePhone: jest.fn(async () => ({ id: 'user', phone: null })),
    updateAddress: jest.fn(async () => ({
      id: 'user',
      address: 'new-address',
    })),
    removeAddress: jest.fn(async () => ({ id: 'user', address: null })),
  };
  beforeAll(async () => {
    await mkdir(uploadTempRoot, { recursive: true });
    const module = await Test.createTestingModule({
      controllers: [ProfileApiController],
      providers: [
        IdempotencyInterceptor,
        { provide: ProfileApiService, useValue: service },
        {
          provide: IdempotencyService,
          useValue: new IdempotencyService(store.repository),
        },
      ],
    })
      .overrideGuard(CsrfGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          if (!req.headers.authorization) throw new UnauthorizedException();
          req.user = {
            userEntity: { id: req.headers.authorization },
            sessionEntity: { id: 'session' },
          };
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
    png = await sharp({
      create: { width: 1, height: 1, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
  });
  beforeEach(async () => {
    jest.clearAllMocks();
    store.rows.clear();
    permitted = true;
    filesBefore = (await readdir(uploadTempRoot)).sort();
  });
  afterEach(async () => {
    expect((await readdir(uploadTempRoot)).sort()).toEqual(filesBefore);
  });
  afterAll(async () => {
    await app?.close();
  });

  const phone = {
    phone_country_id: 'country',
    phone_calling_code: '+1',
    phone_national_number: '4165551234',
    phone_e164: '+14165551234',
  };
  const address = {
    address_line_1: '1 Test St',
    city: 'Ottawa',
    region_id: 'region',
    postal_code: 'K1A 0B1',
    country_id: 'country',
  };
  it.each([
    ['post', 'avatar', 'uploadAvatar', 201],
    ['delete', 'avatar', 'removeAvatar', 200],
    ['post', 'phone', 'updatePhone', 201],
    ['delete', 'phone', 'removePhone', 200],
    ['post', 'address', 'updateAddress', 201],
    ['delete', 'address', 'removeAddress', 200],
  ] as const)(
    'replays %s /profile/%s once with its original status',
    async (method, kind, handler, status) => {
      const send = () => {
        const req = request(app.getHttpServer())
          [method](`/profile/${kind}`)
          .set('Authorization', 'actor')
          .set('Idempotency-Key', 'key');
        if (method === 'delete') return req;
        if (kind === 'avatar') return req.attach('avatar', png, 'avatar.png');
        return req.send(kind === 'phone' ? phone : address);
      };
      const original = await send().expect(status);
      expect((await send().expect(status)).body).toEqual(original.body);
      expect(service[handler]).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects changed contact payloads and keeps actor scopes independent', async () => {
    const send = (actor: string, body = phone) =>
      request(app.getHttpServer())
        .post('/profile/phone')
        .set('Authorization', actor)
        .set('Idempotency-Key', 'key')
        .send(body);
    await send('one').expect(201);
    await send('one', { ...phone, phone_e164: '+16135559876' }).expect(409);
    await send('two').expect(201);
    expect(service.updatePhone).toHaveBeenCalledTimes(2);
  });

  it('still runs authentication and permission guards before replay', async () => {
    await request(app.getHttpServer())
      .delete('/profile/avatar')
      .set('Authorization', 'actor')
      .set('Idempotency-Key', 'key')
      .expect(200);
    await request(app.getHttpServer())
      .delete('/profile/avatar')
      .set('Idempotency-Key', 'key')
      .expect(401);
    permitted = false;
    await request(app.getHttpServer())
      .delete('/profile/avatar')
      .set('Authorization', 'actor')
      .set('Idempotency-Key', 'key')
      .expect(403);
    expect(service.removeAvatar).toHaveBeenCalledTimes(1);
  });
});
