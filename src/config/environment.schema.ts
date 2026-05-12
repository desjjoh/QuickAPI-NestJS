import { JwtSignOptions } from '@nestjs/jwt';
import { createRequire } from 'module';
import path from 'path';
import { z } from 'zod';

import { rootPath } from '@/common/helpers/path.helper';

export type log_level =
  | 'error'
  | 'fatal'
  | 'warn'
  | 'info'
  | 'debug'
  | 'trace'
  | 'silent';

export type mode = 'development' | 'test' | 'production';

const req: NodeJS.Require = createRequire(path.join(rootPath, 'package.json'));

const pkgPath: string = path.join(rootPath, 'package.json');
const pkg = req(pkgPath);

const positiveIntegerFromEnv = z.coerce.number().int().positive();
const nonNegativeIntegerFromEnv = z.coerce.number().int().nonnegative();

const arrayFromEnv = z
  .string()
  .min(1)
  .transform((value) =>
    value
      .split(',')
      .map((type) => type.trim())
      .filter(Boolean),
  );

const booleanFromEnv = z.preprocess((value) => {
  if (value === undefined) return undefined;

  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  return value;
}, z.boolean());

export const EnvSchema = z
  .object({
    APP_NAME: z.string().default(pkg.name),
    APP_VERSION: z
      .string()
      .regex(
        /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?$/,
        'APP_VERSION must follow full SemVer (e.g., 1.2.3 or 1.2.3-beta+001)',
      )
      .default(pkg.version),

    PUBLIC_API_URL: z.url(),
    PUBLIC_WEB_URL: z.url(),
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number(),
    LOG_LEVEL: z.enum([
      'fatal',
      'error',
      'warn',
      'info',
      'debug',
      'trace',
      'silent',
    ]),

    CORS_ORIGINS: arrayFromEnv.pipe(z.array(z.url()).min(1)),
    CORS_METHODS: arrayFromEnv.pipe(
      z
        .array(
          z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']),
        )
        .min(1),
    ),
    CORS_ALLOWED_HEADERS: arrayFromEnv,
    CORS_EXPOSED_HEADERS: arrayFromEnv,
    CORS_CREDENTIALS: booleanFromEnv.default(false),
    CORS_MAX_AGE_SECONDS: positiveIntegerFromEnv,

    HTTPS_ENABLED: booleanFromEnv.default(false),
    HTTPS_KEY_PATH: z.string().optional(),
    HTTPS_CERT_PATH: z.string().optional(),

    COOKIE_SECURE: booleanFromEnv.default(false),
    COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),
    COOKIE_PATH: z.string().min(1).default('/'),
    COOKIE_DOMAIN: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value === '' ? undefined : value)),

    REFRESH_COOKIE_NAME: z.string().min(1).default('refresh_token'),
    REFRESH_COOKIE_MAX_AGE_DAYS: positiveIntegerFromEnv.default(7),
    CSRF_COOKIE_NAME: z.string().min(1).default('csrf_token'),
    CSRF_COOKIE_MAX_AGE_MINUTES: positiveIntegerFromEnv.default(15),

    STATIC_SERVE_ENABLED: booleanFromEnv.default(false),
    STATIC_ROOT_PATH: z.string().min(1).default('public'),
    STATIC_SERVE_ROOT: z.string().min(1).default('/'),

    UPLOAD_TMP_DIR: z.string().min(1).default('tmp'),

    ALLOWED_HTTP_METHODS: arrayFromEnv.pipe(
      z
        .array(
          z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']),
        )
        .min(1),
    ),

    ALLOWED_CONTENT_TYPES: arrayFromEnv.pipe(z.array(z.string().min(1)).min(1)),

    RATE_LIMIT_WINDOW_MS: positiveIntegerFromEnv.default(60_000),
    RATE_LIMIT_MAX: positiveIntegerFromEnv.default(200),

    REQUEST_TIMEOUT_MS: positiveIntegerFromEnv.default(5_000),
    REQUEST_BODY_LIMIT_BYTES: positiveIntegerFromEnv.default(1_048_576),

    HEADER_MAX_COUNT: positiveIntegerFromEnv.default(100),
    HEADER_MAX_SINGLE_BYTES: positiveIntegerFromEnv.default(4_096),
    HEADER_MAX_TOTAL_BYTES: positiveIntegerFromEnv.default(8_192),
    HEADER_ALLOW_CHUNKED: booleanFromEnv.default(false),

    GLOBAL_THROTTLE_TTL_MINUTES: positiveIntegerFromEnv.default(60),
    GLOBAL_THROTTLE_LIMIT: positiveIntegerFromEnv.default(200),

    DB_HOST: z.string(),
    DB_PORT: z.coerce.number(),
    DB_USER: z.string(),
    DB_PASSWORD: z.string(),
    DB_DATABASE: z.string(),

    DB_SYNC: booleanFromEnv.default(false),
    DB_SEED: booleanFromEnv.default(false),

    DB_MIGRATIONS_RUN: booleanFromEnv.default(false),
    DB_SSL: booleanFromEnv.default(false),
    DB_SSL_REJECT_UNAUTHORIZED: booleanFromEnv.default(true),
    DB_POOL_CONNECTION_LIMIT: positiveIntegerFromEnv.default(10),
    DB_POOL_WAIT_FOR_CONNECTIONS: booleanFromEnv.default(true),
    DB_POOL_QUEUE_LIMIT: nonNegativeIntegerFromEnv.default(0),
    DB_CONNECT_TIMEOUT_MS: positiveIntegerFromEnv.default(10_000),
    DB_SLOW_QUERY_LOG_MS: nonNegativeIntegerFromEnv.default(1_000),

    JWT_SECRET_KEY: z.string().min(32),
    REFRESH_SECRET_KEY: z.string().min(32),
    CRYPTO_SECRET: z.string().min(32),

    JWT_EXPIRY_TIME: z.custom<JwtSignOptions['expiresIn']>(
      (value) => typeof value === 'string' || typeof value === 'number',
      {
        message: 'JWT_EXPIRY_TIME must be a valid JWT expiresIn value.',
      },
    ),

    REFRESH_EXPIRY_TIME: z.custom<JwtSignOptions['expiresIn']>(
      (value) => typeof value === 'string' || typeof value === 'number',
      {
        message: 'REFRESH_EXPIRY_TIME must be a valid JWT expiresIn value.',
      },
    ),

    POSTMARK_SERVER_TOKEN: z.string().min(1),
    POSTMARK_FROM_EMAIL: z.email(),
    POSTMARK_MESSAGE_STREAM: z
      .enum(['outbound', 'broadcast'])
      .default('outbound'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.DB_SYNC === true) {
      ctx.addIssue({
        code: 'custom',
        path: ['DB_SYNC'],
        message: 'DB_SYNC must be false in production. Use migrations.',
      });
    }

    if (env.HTTPS_ENABLED && !env.HTTPS_KEY_PATH) {
      ctx.addIssue({
        code: 'custom',
        path: ['HTTPS_KEY_PATH'],
        message: 'HTTPS_KEY_PATH is required when HTTPS_ENABLED is true.',
      });
    }

    if (env.HTTPS_ENABLED && !env.HTTPS_CERT_PATH) {
      ctx.addIssue({
        code: 'custom',
        path: ['HTTPS_CERT_PATH'],
        message: 'HTTPS_CERT_PATH is required when HTTPS_ENABLED is true.',
      });
    }
  });

export type AppEnv = z.infer<typeof EnvSchema>;

export function parseEnv(input: NodeJS.ProcessEnv): AppEnv {
  return EnvSchema.parse(input);
}
