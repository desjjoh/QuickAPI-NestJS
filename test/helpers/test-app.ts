import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AppModule } from '@/modules/app.module';
import {
  closeAllTestDataSources,
  resetMutableTables,
} from './database/test-database';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();

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
export async function setupTestSuite(): Promise<TestSuite> {
  const app = await createTestApp();
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
