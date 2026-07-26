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
