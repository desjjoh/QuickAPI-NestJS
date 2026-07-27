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

  if (configure) builder = configure(builder);
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  configureNestApplication(app);

  await app.init();

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
