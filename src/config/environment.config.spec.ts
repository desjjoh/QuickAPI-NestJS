import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parse } from 'dotenv';

import { parseEnv } from './environment.schema';

function createValidEnv(
  overrides: Partial<NodeJS.ProcessEnv> = {},
): NodeJS.ProcessEnv {
  const envExamplePath = resolve(process.cwd(), '.env.example');
  const envExample = parse(readFileSync(envExamplePath));

  return {
    ...envExample,
    ...overrides,
  };
}

describe('environment config', () => {
  const productionSecrets = {
    JWT_SECRET_KEY: '01'.repeat(32),
    REFRESH_SECRET_KEY: '23'.repeat(32),
    CRYPTO_SECRET: '45'.repeat(32),
  };

  it('parses .env.example as a valid environment', () => {
    const env = parseEnv(createValidEnv());

    expect(env.NODE_ENV).toBeDefined();
    expect(env.PORT).toEqual(expect.any(Number));
    expect(env.CORS_CREDENTIALS).toEqual(expect.any(Boolean));
    expect(env.DB_SYNC).toEqual(expect.any(Boolean));
    expect(env.DB_POOL_CONNECTION_LIMIT).toEqual(expect.any(Number));
    expect(env.DB_POOL_WAIT_FOR_CONNECTIONS).toEqual(expect.any(Boolean));
    expect(env.DOCUMENTATION_ENABLED).toBe(false);
    expect(env.METRICS_ENABLED).toBe(false);
    expect(env.DETAILED_DIAGNOSTICS_ENABLED).toBe(false);
  });

  it('requires an operations credential for each protected surface', () => {
    for (const setting of ['METRICS_ENABLED', 'DETAILED_DIAGNOSTICS_ENABLED']) {
      expect(() =>
        parseEnv(
          createValidEnv({ [setting]: 'true', OPERATIONS_TOKEN: undefined }),
        ),
      ).toThrow(/OPERATIONS_TOKEN is required/);
    }
  });

  it('allows documentation to be enabled independently', () => {
    const env = parseEnv(
      createValidEnv({
        DOCUMENTATION_ENABLED: 'true',
        METRICS_ENABLED: 'false',
        DETAILED_DIAGNOSTICS_ENABLED: 'false',
      }),
    );

    expect(env.DOCUMENTATION_ENABLED).toBe(true);
  });

  it('does not require an operations credential in development', () => {
    const env = parseEnv(
      createValidEnv({
        NODE_ENV: 'development',
        METRICS_ENABLED: 'true',
        DETAILED_DIAGNOSTICS_ENABLED: 'true',
        OPERATIONS_TOKEN: undefined,
      }),
    );

    expect(env.OPERATIONS_TOKEN).toBeUndefined();
  });

  it('parses CSV values into arrays', () => {
    const env = parseEnv(
      createValidEnv({
        CORS_ORIGINS: 'https://localhost:5173,https://app.example.com',
        CORS_METHODS: 'GET,POST,PATCH',
        ALLOWED_HTTP_METHODS: 'GET,POST,DELETE',
        ALLOWED_CONTENT_TYPES: 'application/json,multipart/form-data',
      }),
    );

    expect(env.CORS_ORIGINS).toEqual([
      'https://localhost:5173',
      'https://app.example.com',
    ]);

    expect(env.CORS_METHODS).toEqual(['GET', 'POST', 'PATCH']);
    expect(env.ALLOWED_HTTP_METHODS).toEqual(['GET', 'POST', 'DELETE']);
    expect(env.ALLOWED_CONTENT_TYPES).toEqual([
      'application/json',
      'multipart/form-data',
    ]);
  });

  it('rejects DB_SYNC=true in production', () => {
    expect(() =>
      parseEnv(
        createValidEnv({
          NODE_ENV: 'production',
          DB_SYNC: 'true',
        }),
      ),
    ).toThrow();
  });

  it('rejects enabling Bull Board in production', () => {
    expect(() =>
      parseEnv(
        createValidEnv({
          NODE_ENV: 'production',
          BULL_BOARD_ENABLED: 'true',
        }),
      ),
    ).toThrow(/BULL_BOARD_ENABLED must be false in production/);
  });

  it('allows Bull Board to remain disabled in production', () => {
    const env = parseEnv(
      createValidEnv({
        NODE_ENV: 'production',
        BULL_BOARD_ENABLED: 'false',
        ...productionSecrets,
      }),
    );

    expect(env.BULL_BOARD_ENABLED).toBe(false);
  });

  it('rejects short JWT secrets', () => {
    expect(() =>
      parseEnv(
        createValidEnv({
          JWT_SECRET_KEY: 'too-short',
        }),
      ),
    ).toThrow();
  });

  it.each(['JWT_SECRET_KEY', 'REFRESH_SECRET_KEY', 'CRYPTO_SECRET'] as const)(
    'rejects the %s example sentinel in production',
    (name) => {
      expect(() =>
        parseEnv(
          createValidEnv({
            NODE_ENV: 'production',
            ...productionSecrets,
            [name]: createValidEnv()[name],
          }),
        ),
      ).toThrow(/must be a generated secret/);
    },
  );

  it('rejects human-readable and reused cryptographic secrets in production', () => {
    expect(() =>
      parseEnv(
        createValidEnv({
          NODE_ENV: 'production',
          JWT_SECRET_KEY:
            'this-is-long-but-not-a-generated-random-secret-value',
          REFRESH_SECRET_KEY: productionSecrets.CRYPTO_SECRET,
          CRYPTO_SECRET: productionSecrets.CRYPTO_SECRET,
        }),
      ),
    ).toThrow();
  });

  it('does not require credentials for disabled integrations in production', () => {
    const env = parseEnv(
      createValidEnv({
        NODE_ENV: 'production',
        ...productionSecrets,
        BULL_BOARD_ENABLED: 'false',
        POSTMARK_ENABLED: 'false',
        POSTMARK_SERVER_TOKEN: undefined,
        POSTMARK_FROM_EMAIL: undefined,
        STORAGE_DRIVER: 'local',
        R2_ACCOUNT_ID: undefined,
        R2_ENDPOINT: undefined,
        R2_ACCESS_KEY_ID: undefined,
        R2_SECRET_ACCESS_KEY: undefined,
        R2_BUCKET_NAME: undefined,
        R2_PUBLIC_BASE_URL: undefined,
      }),
    );

    expect(env.POSTMARK_SERVER_TOKEN).toBeUndefined();
    expect(env.R2_ACCESS_KEY_ID).toBeUndefined();
  });

  it.each([
    ['staging', '67'],
    ['production', '89'],
  ])('accepts valid %s deployment credentials', (_deployment, bytePrefix) => {
    const env = parseEnv(
      createValidEnv({
        NODE_ENV: 'production',
        BULL_BOARD_ENABLED: 'false',
        JWT_SECRET_KEY: `${bytePrefix}`.repeat(32),
        REFRESH_SECRET_KEY: 'ab'.repeat(32),
        CRYPTO_SECRET: 'cd'.repeat(32),
        POSTMARK_ENABLED: 'true',
        POSTMARK_SERVER_TOKEN: `pm-${bytePrefix}-live-token`,
        POSTMARK_FROM_EMAIL: 'noreply@service.example',
        STORAGE_DRIVER: 'r2',
        R2_ACCOUNT_ID: `account-${bytePrefix}`,
        R2_ENDPOINT: `https://${bytePrefix}.r2.cloudflarestorage.com`,
        R2_ACCESS_KEY_ID: `access-${bytePrefix}`,
        R2_SECRET_ACCESS_KEY: `secret-${bytePrefix}`,
        R2_BUCKET_NAME: `uploads-${bytePrefix}`,
        R2_PUBLIC_BASE_URL: `https://cdn-${bytePrefix}.example.com`,
      }),
    );

    expect(env.STORAGE_DRIVER).toBe('r2');
  });

  it('rejects enabled Postmark and R2 example credentials in production', () => {
    const example = createValidEnv();
    expect(() =>
      parseEnv({
        ...example,
        NODE_ENV: 'production',
        ...productionSecrets,
        POSTMARK_ENABLED: 'true',
        STORAGE_DRIVER: 'r2',
      }),
    ).toThrow(/sentinel/);
  });

  it('rejects invalid Postmark sender email', () => {
    expect(() =>
      parseEnv(
        createValidEnv({
          POSTMARK_FROM_EMAIL: 'not-an-email',
        }),
      ),
    ).toThrow();
  });
});
