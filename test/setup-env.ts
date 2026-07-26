import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const envPath = resolve(process.cwd(), '.env');
const envExamplePath = resolve(process.cwd(), '.env.example');

if (existsSync(envPath))
  loadEnv({ path: envPath, override: false, quiet: true });
else if (existsSync(envExamplePath))
  loadEnv({ path: envExamplePath, override: false, quiet: true });

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

if (process.env.TEST_DB_ENABLED === 'true') {
  const testDatabase = process.env.TEST_DB_DATABASE;

  if (!testDatabase)
    throw new Error('TEST_DB_DATABASE is required when TEST_DB_ENABLED=true.');

  // Test-specific connection values are applied before application config is
  // imported. Host/port/credentials may fall back to a disposable CI service,
  // but the database itself must always be explicitly configured.
  process.env.DB_HOST = process.env.TEST_DB_HOST ?? process.env.DB_HOST;
  process.env.DB_PORT = process.env.TEST_DB_PORT ?? process.env.DB_PORT;
  process.env.DB_USER = process.env.TEST_DB_USER ?? process.env.DB_USER;
  process.env.DB_PASSWORD =
    process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD;
  process.env.DB_DATABASE = testDatabase;
  process.env.DB_SYNC = 'false';
}
