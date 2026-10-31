import {
  Body,
  Controller,
  Delete,
  HttpCode,
  INestApplication,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { Idempotent } from '@/common/decorators/idempotent.decorator';
import { IdempotencyInterceptor } from '@/common/interceptors/idempotency.interceptor';
import { IdempotencyService } from '@/modules/system/idempotency/services/idempotency.service';
import { idempotencyTestStore } from '../../../helpers/idempotency-test-store';

@Controller('scope')
class ScopeController {
  public calls = 0;

  @Post('user')
  @Idempotent('create')
  public user(@Body() body: { value: string }) {
    return this.perform(body);
  }

  @Post('explicit-user')
  @Idempotent('create', { scope: 'user' })
  public explicitUser(@Body() body: { value: string }) {
    return this.perform(body);
  }

  @Post('public')
  @Idempotent('create', { scope: 'public' })
  public publicOperation(@Body() body: { value: string }) {
    return this.perform(body);
  }

  @Delete('public')
  @HttpCode(204)
  @Idempotent('remove', { scope: 'public' })
  public remove(): void {
    this.calls++;
  }

  private perform(body: { value: string }) {
    return { id: `result-${++this.calls}`, value: body.value };
  }
}

describe('explicit idempotency caller scopes', () => {
  let app: INestApplication;
  let controller: ScopeController;
  let store: ReturnType<typeof idempotencyTestStore>;

  beforeAll(async () => {
    store = idempotencyTestStore();
    const module = await Test.createTestingModule({
      controllers: [ScopeController],
      providers: [
        IdempotencyInterceptor,
        {
          provide: IdempotencyService,
          useValue: new IdempotencyService(store.repository),
        },
      ],
    }).compile();

    app = module.createNestApplication({ logger: false });
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const id = req.headers['x-test-user-id'];

      if (id !== undefined)
        req.user = { userEntity: { id } } as Request['user'];
      next();
    });
    await app.init();
    controller = app.get(ScopeController);
  });

  beforeEach(() => {
    store.rows.clear();
    store.runners.length = 0;
    controller.calls = 0;
  });

  afterEach(() => {
    expect(store.locks.size).toBe(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['user', 'explicit-user'])(
    'requires a user on %s even without a key',
    async (route) => {
      for (const key of [undefined, 'retry-key']) {
        const pending = request(app.getHttpServer()).post(`/scope/${route}`);

        if (key) pending.set('Idempotency-Key', key);
        await pending.send({ value: 'example' }).expect(401);
      }

      expect(controller.calls).toBe(0);
      expect(store.rows.size).toBe(0);
      expect(store.runners).toHaveLength(0);
    },
  );

  it('scopes default replay to the authenticated user', async () => {
    const send = (id: string) =>
      request(app.getHttpServer())
        .post('/scope/user')
        .set('x-test-user-id', id)
        .set('Idempotency-Key', 'same-key')
        .send({ value: 'example' })
        .expect(201);
    const first = await send('user-1');

    expect((await send('user-1')).body).toEqual(first.body);
    expect((await send('user-2')).body.id).not.toBe(first.body.id);
    expect(controller.calls).toBe(2);
  });

  it('replays the explicit public namespace without deriving scope from request identity', async () => {
    const first = await request(app.getHttpServer())
      .post('/scope/public')
      .set('Idempotency-Key', 'public-key')
      .send({ value: 'example' })
      .expect(201);
    const replay = await request(app.getHttpServer())
      .post('/scope/public')
      .set('x-test-user-id', 'user-1')
      .set('Idempotency-Key', 'public-key')
      .send({ value: 'example' })
      .expect(201);

    expect(replay.body).toEqual(first.body);
    expect(controller.calls).toBe(1);
    expect([...store.rows.values()][0].actor_id).toBeNull();

    await request(app.getHttpServer())
      .post('/scope/public')
      .set('Idempotency-Key', 'public-key')
      .send({ value: 'different' })
      .expect(409);
    expect(controller.calls).toBe(1);
  });

  it('executes public requests without a key normally', async () => {
    for (let i = 0; i < 2; i++)
      await request(app.getHttpServer())
        .post('/scope/public')
        .send({ value: 'example' })
        .expect(201);

    expect(controller.calls).toBe(2);
    expect(store.rows.size).toBe(0);
  });

  it('replays public bodyless responses and rejects malformed keys', async () => {
    for (let i = 0; i < 2; i++) {
      const response = await request(app.getHttpServer())
        .delete('/scope/public')
        .set('Idempotency-Key', 'remove-key')
        .expect(204);

      expect(response.text).toBe('');
    }
    await request(app.getHttpServer())
      .post('/scope/public')
      .set('Idempotency-Key', 'invalid key')
      .send({ value: 'example' })
      .expect(400);

    expect(controller.calls).toBe(1);
  });
});
