import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModuleBuilder } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AppModule } from '@/modules/app.module';
import { configureNestApplication } from '@/config/nest.config';
import {
  closeAllTestDataSources,
  resetMutableTables,
} from './database/test-database';
import { QueueEventsProvider } from '@/common/providers/queue.provider';
import { EmailOutboxDispatcher } from '@/modules/system/email/services/email-outbox-dispatcher.service';
import { StorageCleanupDispatcher } from '@/modules/system/storage-cleanup/services/storage-cleanup-dispatcher.service';
import { getQueueToken, WorkerHost } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailQueueProcessor } from '@/modules/system/email/processors/email.processor';
import { EmailDeadLetterQueueProcessor } from '@/modules/system/email/processors/dlq.processor';
import {
  EMAIL_QUEUE,
  EMAIL_DLQ,
} from '@/modules/system/email/queues/queue.tokens';
import { StorageCleanupProcessor } from '@/modules/system/storage-cleanup/processors/storage-cleanup.processor';
import { StorageCleanupDeadLetterProcessor } from '@/modules/system/storage-cleanup/processors/storage-cleanup-dlq.processor';
import {
  STORAGE_CLEANUP_QUEUE,
  STORAGE_CLEANUP_DLQ,
} from '@/modules/system/storage-cleanup/queues/storage-cleanup.queue';

export async function createTestApp(
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  });

  // Queue delivery is outside the scope of the in-process E2E application.
  // More importantly, constructing BullMQ's QueueEventsProvider makes a real
  // Redis connection and deliberately terminates the process if Redis is not
  // available. E2E runs must remain deterministic (and must never call
  // process.exit), so replace only the queue event listener while keeping the
  // rest of the application graph intact.
  builder = builder.overrideProvider(QueueEventsProvider).useValue({});
  // Outbox delivery is exercised explicitly in its disposable-database suite.
  builder = builder.overrideProvider(EmailOutboxDispatcher).useValue({});
  builder = builder.overrideProvider(StorageCleanupDispatcher).useValue({});

  if (configure) builder = configure(builder);
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  configureNestApplication(app);

  await app.init();
  const workers = [
    EmailQueueProcessor,
    EmailDeadLetterQueueProcessor,
    StorageCleanupProcessor,
    StorageCleanupDeadLetterProcessor,
  ].map((processor) => app.get<WorkerHost>(processor).worker);

  // Nest init starts BullMQ connections but does not await their asynchronous
  // Redis handshake. Returning early lets fast tests close the application
  // while INFO/script initialization is still running, especially in CI.
  await Promise.all([
    ...[EMAIL_QUEUE, EMAIL_DLQ, STORAGE_CLEANUP_QUEUE, STORAGE_CLEANUP_DLQ].map(
      (name) => app.get<Queue>(getQueueToken(name)).waitUntilReady(),
    ),
    ...workers.map((worker) => worker.waitUntilReady()),
  ]);

  // App-level queue consumption is outside these HTTP suites; dedicated queue
  // suites create their own workers. Pause only these local workers (not Redis
  // queues) so they cannot consume unrelated retained jobs between tests.
  await Promise.all(workers.map((worker) => worker.pause(true)));

  // Idle blocking Redis connections must be disconnected, not gracefully QUIT
  // while disconnected. Force-close these paused test workers before Nest's
  // shutdown hook; production keeps its normal graceful shutdown behavior.
  const close = app.close.bind(app);
  app.close = async () => {
    await Promise.all(workers.map((worker) => worker.close(true)));
    await close();
  };

  return app;
}

export type TestSuite = {
  app: INestApplication;
  dataSource: DataSource;
  resetDatabase: () => Promise<void>;
  close: () => Promise<void>;
};

/**
 * Creates an application for a suite. Global setup has already migrated and
 * seeded the schema; mutable rows are cleared here so a spec also starts clean.
 */
export async function setupTestSuite(
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<TestSuite> {
  const app = await createTestApp(configure);
  const dataSource = app.get(DataSource);
  await resetMutableTables(dataSource);

  return {
    app,
    dataSource,
    resetDatabase: () => resetMutableTables(dataSource),
    close: async () => {
      await app.close();
      await closeAllTestDataSources();
    },
  };
}

export async function teardownTestSuite(suite: TestSuite): Promise<void> {
  await suite.close();
}
