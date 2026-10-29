import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assertSafeTestRedis } from './helpers/database/safety';

const loaded = loadEnv({
  path: resolve(process.cwd(), '.env.test'),
  override: false,
  quiet: true,
});

if (loaded.error) throw loaded.error;

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Multer must never inherit a developer's shared upload directory. Individual
// suites remove this process-local directory during teardown.
process.env.UPLOAD_TMP_DIR = join(tmpdir(), `quickapi-e2e-${process.pid}`);

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
process.env.STORAGE_DRIVER = 'r2';
process.env.R2_ACCOUNT_ID = 'cloudflare-test-account';
process.env.R2_ENDPOINT =
  'https://cloudflare-test-account.r2.cloudflarestorage.com';
process.env.R2_ACCESS_KEY_ID = 'R2_TEST_ACCESS_KEY_ID';
process.env.R2_SECRET_ACCESS_KEY = 'R2_TEST_SECRET_ACCESS_KEY';
process.env.R2_BUCKET_NAME = 'quickapi-test';
process.env.R2_PUBLIC_BASE_URL = 'https://assets.test.example.com';

// Only explicitly test-scoped values may select destructive dependencies.
// Inherited DB_*/REDIS_* settings (including development shell exports) cannot win.
for (const name of ['HOST', 'PORT', 'USER', 'PASSWORD', 'DATABASE']) {
  const value = process.env[`TEST_DB_${name}`];
  if (value === undefined || value === '')
    throw new Error(`TEST_DB_${name} is required.`);
  process.env[`DB_${name}`] = value;
}
for (const name of ['HOST', 'PORT', 'PASSWORD']) {
  const value = process.env[`TEST_REDIS_${name}`];
  if (value === undefined || (name !== 'PASSWORD' && value === ''))
    throw new Error(`TEST_REDIS_${name} is required.`);
  process.env[`REDIS_${name}`] = value;
}
process.env.DB_SYNC = 'false';
process.env.DB_SSL = 'false';
assertSafeTestRedis();
