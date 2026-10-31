import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import request from 'supertest';
import applicationDataSource from '@/database/typeorm.datasource';
import { Transactional } from '@/common/decorators/transactional.decorator';
import { Idempotent } from '@/common/decorators/idempotent.decorator';
import { RequestTimeout } from '@/common/decorators/request-timeout.decorator';
import { TimeoutInterceptor } from '@/common/interceptors/timeout.interceptor';
import {
  hasApplicationTransaction,
  requireApplicationTransaction,
  runInTransaction,
} from '@/common/helpers/transaction.helper';
import { activeIdempotencyKey } from '@/common/store/idempotency-context.store';
import { TransactionsModule } from '@/modules/system/transactions/transactions.module';
import { IdempotencyModule } from '@/modules/system/idempotency/idempotency.module';
import { IdempotencyEntity } from '@/modules/system/idempotency/entities/idempotency.entity';
import { ImageEntity } from '@/modules/domain/media/entities/image.entity';
import { AuditEventEntity } from '@/modules/domain/audit/entities/audit-event.entity';
import { ImageService } from '@/modules/domain/media/services/image.service';
import { ImageRepository } from '@/modules/domain/media/repositories/image.repository';
import { AuditQueryService } from '@/modules/domain/audit/services/audit-query.service';
import { AuditRepository } from '@/modules/domain/audit/repositories/audit.repository';
import {
  initializeTestDataSource,
  closeTestDataSource,
  resetMutableTables,
} from '../../helpers/database/test-database';

@Controller('transaction-fixture')
class TransactionFixtureController {
  public commits = 0;
  public rollbacks = 0;
  public entered?: () => void;
  public drained?: () => void;
  public pending?: Promise<void>;

  public constructor(
    private readonly source: DataSource,
    private readonly images: ImageService,
    private readonly audits: AuditQueryService,
  ) {}

  @Get()
  public read() {
    return { transactional: hasApplicationTransaction() };
  }

  @Post()
  @Transactional()
  public mutate(@Body() body: { fail?: boolean }) {
    return this.work(body.fail);
  }

  @Post('keyed')
  @Transactional()
  @Idempotent('fixture.create', { scope: 'public' })
  public keyed() {
    return this.work();
  }

  @Post('reversed')
  @Idempotent('fixture.create', { scope: 'public' })
  @Transactional()
  public reversed() {
    return this.work();
  }

  @Post('slow')
  @RequestTimeout(1000)
  @Transactional()
  public slow() {
    return this.work();
  }

  private async work(fail = false) {
    const outer = requireApplicationTransaction();

    outer.lifecycle.afterCommit(() => {
      this.commits++;
    });
    outer.lifecycle.afterRollback(() => {
      this.rollbacks++;
      this.drained?.();
    });

    const result = await runInTransaction(
      this.source.manager,
      async (manager, lifecycle) => {
        if (manager !== outer.manager || lifecycle !== outer.lifecycle)
          throw new Error('Domain work escaped the route transaction.');
        const image = await manager.save(
          ImageEntity,
          manager.create(ImageEntity, {
            storage_key: 'transaction-fixture/image.png',
            filename: 'image.png',
            mime_type: 'image/png',
            size_bytes: 1,
            width: 1,
            height: 1,
          }),
        );

        const audit = await manager.save(
          AuditEventEntity,
          manager.create(AuditEventEntity, {
            event: 'identity.transaction_fixture.created',
            actor_type: 'anonymous',
            domain: 'identity',
            source: 'http',
            resource_type: 'media.image',
            resource_id: image.id,
            occurred_at: new Date(),
            idempotency_key: activeIdempotencyKey(),
          }),
        );

        // These service reads must see uncommitted writes without an explicit
        // manager override, and must not acquire another root connection.
        const loadedImage = await this.images.findById(image.id);
        const loadedAudit = await this.audits.findById(audit.id);

        if (loadedImage.id !== image.id || loadedAudit?.id !== audit.id)
          throw new Error('A service read escaped the active transaction.');

        return { id: image.id };
      },
    );

    this.entered?.();
    if (this.pending) await this.pending;
    if (fail) throw new Error('Failure after mutation and audit.');

    return result;
  }
}

describe('route-owned transactions (disposable MySQL)', () => {
  let app: INestApplication;
  let source: DataSource;
  let inspection: DataSource;
  let controller: TransactionFixtureController;
  let runners: jest.SpiedFunction<DataSource['createQueryRunner']>;

  beforeAll(async () => {
    inspection = await initializeTestDataSource();
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          ...applicationDataSource.options,
          migrations: [],
          synchronize: false,
          migrationsRun: false,
        }),
        TransactionsModule,
        IdempotencyModule,
      ],
      controllers: [TransactionFixtureController],
      providers: [
        {
          provide: ImageService,
          inject: [DataSource],
          useFactory: (dataSource: DataSource) =>
            new ImageService(
              new ImageRepository(dataSource),
              {} as never,
              {} as never,
              {} as never,
            ),
        },
        {
          provide: AuditQueryService,
          inject: [DataSource],
          useFactory: (dataSource: DataSource) =>
            new AuditQueryService(new AuditRepository(dataSource)),
        },
      ],
    }).compile();

    app = module.createNestApplication({ logger: false });
    app.useGlobalInterceptors(new TimeoutInterceptor(10_000));
    await app.init();
    source = app.get(DataSource);
    controller = app.get(TransactionFixtureController);
  });

  beforeEach(async () => {
    await resetMutableTables(inspection);
    controller.commits = 0;
    controller.rollbacks = 0;
    controller.entered = undefined;
    controller.drained = undefined;
    controller.pending = undefined;
    runners = jest.spyOn(source, 'createQueryRunner');
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
    await closeTestDataSource(inspection);
  });

  it('does not open a transaction for an ordinary read', async () => {
    const response = await request(app.getHttpServer())
      .get('/transaction-fixture')
      .expect(200);

    expect(response.body).toEqual({ transactional: false });
    expect(runners).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'owns mutation, audit and lifecycle atomically (failure=%s)',
    async (fail) => {
      await request(app.getHttpServer())
        .post('/transaction-fixture')
        .send({ fail })
        .expect(fail ? 500 : 201);

      expect(runners).toHaveBeenCalledTimes(1);
      expect(await inspection.getRepository(ImageEntity).count()).toBe(
        fail ? 0 : 1,
      );
      expect(await inspection.getRepository(AuditEventEntity).count()).toBe(
        fail ? 0 : 1,
      );
      expect(await inspection.getRepository(IdempotencyEntity).count()).toBe(0);
      expect(controller.commits).toBe(fail ? 0 : 1);
      expect(controller.rollbacks).toBe(fail ? 1 : 0);
    },
  );

  it.each(['keyed', 'reversed'])(
    'shares one boundary with idempotency regardless of decorator order: %s',
    async (route) => {
      const send = () =>
        request(app.getHttpServer())
          .post(`/transaction-fixture/${route}`)
          .set('Idempotency-Key', 'route-key')
          .send({})
          .expect(201);
      const first = await send();

      expect(runners).toHaveBeenCalledTimes(1);
      expect((await send()).body).toEqual(first.body);
      expect(await inspection.getRepository(ImageEntity).count()).toBe(1);
      expect(await inspection.getRepository(AuditEventEntity).count()).toBe(1);
      expect(await inspection.getRepository(IdempotencyEntity).count()).toBe(1);
      expect(controller.commits).toBe(1);
      expect(
        (
          await inspection
            .getRepository(AuditEventEntity)
            .findOneByOrFail({ resource_id: first.body.id })
        ).idempotency_key,
      ).toBe('route-key');
    },
  );

  it('keeps a timed-out request transaction alive until its work settles, then rolls back', async () => {
    let resume!: () => void;
    const entered = new Promise<void>((resolve) => {
      controller.entered = resolve;
    });
    const drained = new Promise<void>((resolve) => {
      controller.drained = resolve;
    });
    controller.pending = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const operation = request(app.getHttpServer())
      .post('/transaction-fixture/slow')
      .send({})
      .then((value) => value);
    await entered;
    const isReleased = () => {
      const result = runners.mock.results[0];

      if (result.type !== 'return')
        throw new Error('Query runner creation failed.');

      return result.value.isReleased;
    };

    try {
      expect((await operation).status).toBe(408);
      expect(isReleased()).toBe(false);
      expect(await inspection.getRepository(ImageEntity).count()).toBe(0);
      expect(await inspection.getRepository(AuditEventEntity).count()).toBe(0);
    } finally {
      resume();
    }

    await drained;
    expect(isReleased()).toBe(true);
    expect(controller.commits).toBe(0);
    expect(controller.rollbacks).toBe(1);
    expect(await inspection.getRepository(ImageEntity).count()).toBe(0);
    expect(await inspection.getRepository(AuditEventEntity).count()).toBe(0);
    await request(app.getHttpServer())
      .post('/transaction-fixture')
      .send({})
      .expect(201);
    expect(await inspection.getRepository(ImageEntity).count()).toBe(1);
  });
});
