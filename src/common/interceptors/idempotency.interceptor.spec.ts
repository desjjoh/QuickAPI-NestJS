import {
  Body,
  Controller,
  ExecutionContext,
  INestApplication,
  Injectable,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import { mkdir, readdir } from 'node:fs/promises';
import request from 'supertest';
import sharp from 'sharp';
import { Idempotent } from '../decorators/idempotent.decorator';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { ImageFileInterceptor } from './image-file.interceptor';
import { IdempotencyService } from '@/modules/system/idempotency/services/idempotency.service';
import { idempotencyTestStore } from '../../../test/helpers/idempotency-test-store';
import { uploadTempRoot } from '@/config/storage.config';
import { ArticleVersionDto } from '@/modules/domain/articles/models/article-version.model';
import { canonicalJson } from '../helpers/request-fingerprint.helper';
import { sanitizeHeadersMiddleware } from '../middleware/header-sanitization.middleware';

class UploadBody {
  @IsString() public title!: string;
}
@Injectable()
class ActorGuard {
  public canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (!req.headers.authorization) throw new UnauthorizedException();
    req.user = { userEntity: { id: req.headers.authorization } };
    return true;
  }
}
@Controller('idempotency')
@UseGuards(ActorGuard)
class RetryController {
  public calls = 0;
  public fail = false;
  @Post('create')
  @Idempotent('create')
  @UseInterceptors(ImageFileInterceptor('hero', 4096))
  public create(
    @Body() body: UploadBody,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (this.fail) throw new Error('simulated failure');
    this.calls++;
    return {
      id: `article-${this.calls}`,
      title: body.title,
      originalName: file.originalname,
      version: 1,
    };
  }
  @Put(':id/hero')
  @Idempotent('replace')
  @UseInterceptors(ImageFileInterceptor('hero', 4096))
  public replace(
    @Body() body: ArticleVersionDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.calls++;
    return {
      id: 'article-1',
      version: body.expected_version + 1,
      originalName: file.originalname,
    };
  }
  @Post(':id/publish')
  @Idempotent('publish')
  public publish(@Body() body: ArticleVersionDto) {
    this.calls++;
    return { id: 'article-1', version: body.expected_version + 1 };
  }
}

describe('idempotency HTTP and multipart integration', () => {
  let app: INestApplication;
  let controller: RetryController;
  let png: Buffer;
  let differentPng: Buffer;
  let filesBefore: string[];
  const store = idempotencyTestStore();
  beforeAll(async () => {
    await mkdir(uploadTempRoot, { recursive: true });
    const module = await Test.createTestingModule({
      controllers: [RetryController],
      providers: [
        ActorGuard,
        IdempotencyInterceptor,
        {
          provide: IdempotencyService,
          useValue: new IdempotencyService(store.repository),
        },
      ],
    }).compile();
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
    controller = app.get(RetryController);
    png = await sharp({
      create: { width: 1, height: 1, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    differentPng = await sharp({
      create: { width: 1, height: 1, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
  });
  beforeEach(async () => {
    controller.calls = 0;
    controller.fail = false;
    store.rows.clear();
    filesBefore = (await readdir(uploadTempRoot)).sort();
  });
  afterEach(async () => {
    expect((await readdir(uploadTempRoot)).sort()).toEqual(filesBefore);
    expect(store.locks.size).toBe(0);
  });
  afterAll(async () => {
    await app?.close();
  });
  const create = (
    key = 'key',
    body = 'Title',
    bytes?: Buffer,
    actor = 'actor-1',
  ) =>
    request(app.getHttpServer())
      .post('/idempotency/create')
      .set('Authorization', actor)
      .set('Idempotency-Key', key)
      .field('title', body)
      .attach('hero', bytes ?? png, 'hero.png');

  it('parses multipart before fingerprinting and replays the original 201 without leaking retry files', async () => {
    const first = await create().expect(201);
    const replay = await create().expect(201);
    expect(replay.body).toEqual(first.body);
    expect(controller.calls).toBe(1);
  });
  it('compares both body fields and uploaded bytes', async () => {
    await create().expect(201);
    await create('key', 'Changed').expect(409);
    await create('key', 'Title', differentPng).expect(409);
    expect(controller.calls).toBe(1);
  });
  it('keeps the same key independent for other actors and resource routes', async () => {
    await create().expect(201);
    await create('key', 'Title', png, 'actor-2').expect(201);
    for (const id of ['one', 'two'])
      await request(app.getHttpServer())
        .post(`/idempotency/${id}/publish`)
        .set('Authorization', 'actor-1')
        .set('Idempotency-Key', 'key')
        .send({ expected_version: 1 })
        .expect(201);
    expect(controller.calls).toBe(4);
  });
  it('replays hero replacement using the original expected_version without incrementing again', async () => {
    const replace = () =>
      request(app.getHttpServer())
        .put('/idempotency/one/hero')
        .set('Authorization', 'actor-1')
        .set('Idempotency-Key', 'key')
        .field('expected_version', '1')
        .attach('hero', png, 'hero.png');
    expect((await replace().expect(200)).body.version).toBe(2);
    expect((await replace().expect(200)).body.version).toBe(2);
    expect(controller.calls).toBe(1);
  });
  it('rolls back validation and handler failures, allowing an identical safe retry', async () => {
    controller.fail = true;
    await create().expect(500);
    expect(store.rows.size).toBe(0);
    controller.fail = false;
    await create().expect(201);
    expect(controller.calls).toBe(1);
    await request(app.getHttpServer())
      .post('/idempotency/one/publish')
      .set('Authorization', 'actor-1')
      .set('Idempotency-Key', 'invalid')
      .send({})
      .expect(400);
    expect(store.rows.size).toBe(1);
  });
  it('does not bypass authentication on a completed retry', async () => {
    await create().expect(201);
    await request(app.getHttpServer())
      .post('/idempotency/create')
      .set('Idempotency-Key', 'key')
      .expect(401);
    expect(controller.calls).toBe(1);
  });
  it.each(['', 'has spaces', 'one,two', 'x'.repeat(129)])(
    'rejects an invalid key: %s',
    async (key) => {
      await create(key).expect(400);
      expect(controller.calls).toBe(0);
      expect(store.rows.size).toBe(0);
    },
  );
  it('leaves requests without a key unchanged', async () => {
    for (let count = 0; count < 2; count++)
      await request(app.getHttpServer())
        .post('/idempotency/one/publish')
        .set('Authorization', 'actor-1')
        .send({ expected_version: 1 })
        .expect(201);
    expect(controller.calls).toBe(2);
    expect(store.rows.size).toBe(0);
  });
  it('uses stable key ordering and preserves array order in JSON fingerprints', () => {
    expect(canonicalJson({ b: 2, a: { z: 1, y: 2 } })).toBe(
      canonicalJson({ a: { y: 2, z: 1 }, b: 2 }),
    );
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});
