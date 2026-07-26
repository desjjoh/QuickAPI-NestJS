import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

// nanoid is ESM-only; unit tests do not need cryptographic IDs and run through
// ts-jest's CommonJS runtime. Keep entity imports isolated from that runtime
// concern while retaining deterministic IDs in specifications.
jest.mock('nanoid', () => ({
  customAlphabet: () => () => '0000000000000000',
}));

const envPath = resolve(process.cwd(), '.env');
const envExamplePath = resolve(process.cwd(), '.env.example');

if (existsSync(envPath))
  loadEnv({ path: envPath, override: false, quiet: true });
else if (existsSync(envExamplePath))
  loadEnv({ path: envExamplePath, override: false, quiet: true });

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Unit and E2E suites mock these external clients. Explicitly use inert test
// credentials so a developer's real Postmark or Cloudflare secrets can never
// be consumed by an accidentally constructed client.
process.env.POSTMARK_ENABLED = 'false';
process.env.POSTMARK_SERVER_TOKEN = 'POSTMARK_TEST_TOKEN';
process.env.POSTMARK_FROM_EMAIL = 'noreply@test.example.com';
process.env.R2_ACCOUNT_ID = 'cloudflare-test-account';
process.env.R2_ENDPOINT =
  'https://cloudflare-test-account.r2.cloudflarestorage.com';
process.env.R2_ACCESS_KEY_ID = 'R2_TEST_ACCESS_KEY_ID';
process.env.R2_SECRET_ACCESS_KEY = 'R2_TEST_SECRET_ACCESS_KEY';
process.env.R2_BUCKET_NAME = 'quickapi-test';
process.env.R2_PUBLIC_BASE_URL = 'https://assets.test.example.com';

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
