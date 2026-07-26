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

// Supertest uses an in-process HTTP server. Ensure its cookie jar can return
// the CSRF cookie instead of inheriting production-only Secure/domain flags
// from a developer's local environment.
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_DOMAIN = '';

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
