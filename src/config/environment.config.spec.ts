import { parseEnv } from './environment.config';

function createValidEnv(
  overrides: Partial<NodeJS.ProcessEnv> = {},
): NodeJS.ProcessEnv {
  return {
    APP_NAME: 'quickapi-nestjs',
    APP_VERSION: '1.0.0',

    PUBLIC_API_URL: 'https://localhost:4000',
    NODE_ENV: 'development',
    PORT: '4000',
    LOG_LEVEL: 'info',

    CORS_ORIGINS: 'https://localhost:5173',
    CORS_METHODS: 'GET,POST,PUT,PATCH,DELETE',
    CORS_ALLOWED_HEADERS: 'Content-Type,Authorization,X-CSRF-Token',
    CORS_EXPOSED_HEADERS: 'Authorization,Set-Cookie',
    CORS_CREDENTIALS: 'true',
    CORS_MAX_AGE_SECONDS: '86400',

    HTTPS_ENABLED: 'false',
    HTTPS_KEY_PATH: 'certs/localhost-key.pem',
    HTTPS_CERT_PATH: 'certs/localhost.pem',

    COOKIE_SECURE: 'false',
    COOKIE_SAME_SITE: 'strict',
    COOKIE_PATH: '/',
    COOKIE_DOMAIN: '',
    REFRESH_COOKIE_NAME: 'refresh_token',
    REFRESH_COOKIE_MAX_AGE_DAYS: '7',
    CSRF_COOKIE_NAME: 'csrf_token',
    CSRF_COOKIE_MAX_AGE_MINUTES: '15',

    STATIC_SERVE_ENABLED: 'true',
    STATIC_ROOT_PATH: 'public',
    STATIC_SERVE_ROOT: '/',

    UPLOAD_TMP_DIR: 'tmp',

    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_MAX: '200',

    REQUEST_TIMEOUT_MS: '5000',
    REQUEST_BODY_LIMIT_BYTES: '1048576',

    HEADER_MAX_COUNT: '100',
    HEADER_MAX_SINGLE_BYTES: '4096',
    HEADER_MAX_TOTAL_BYTES: '8192',
    HEADER_ALLOW_CHUNKED: 'false',

    ALLOWED_HTTP_METHODS: 'GET,POST,PUT,PATCH,DELETE',
    ALLOWED_CONTENT_TYPES: 'application/json,multipart/form-data',

    DB_HOST: 'localhost',
    DB_PORT: '3306',
    DB_USER: 'quickapi',
    DB_PASSWORD: 'password',
    DB_DATABASE: 'quickapi_test',
    DB_SYNC: 'false',
    DB_SEED: 'false',
    DB_SSL: 'false',
    DB_SSL_REJECT_UNAUTHORIZED: 'true',
    DB_MIGRATIONS_RUN: 'false',
    DB_SLOW_QUERY_LOG_MS: '1000',
    DB_POOL_CONNECTION_LIMIT: '10',
    DB_POOL_WAIT_FOR_CONNECTIONS: 'true',
    DB_POOL_QUEUE_LIMIT: '100',
    DB_CONNECT_TIMEOUT_MS: '10000',

    JWT_SECRET_KEY: 'a'.repeat(32),
    REFRESH_SECRET_KEY: 'b'.repeat(32),
    CRYPTO_SECRET: 'c'.repeat(32),
    JWT_EXPIRY_TIME: '15m',
    REFRESH_EXPIRY_TIME: '7d',

    POSTMARK_SERVER_TOKEN: 'postmark-test-token',
    POSTMARK_FROM_EMAIL: 'noreply@example.com',
    POSTMARK_MESSAGE_STREAM: 'outbound',

    ...overrides,
  };
}

describe('environment config', () => {
  it('parses a valid environment', () => {
    const env = parseEnv(createValidEnv());

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.CORS_CREDENTIALS).toBe(true);
    expect(env.DB_SYNC).toBe(false);
    expect(env.DB_POOL_CONNECTION_LIMIT).toBe(10);
    expect(env.DB_POOL_WAIT_FOR_CONNECTIONS).toBe(true);
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
