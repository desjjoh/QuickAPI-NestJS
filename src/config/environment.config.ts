import { z, ZodError } from 'zod';
import { createRequire } from 'module';
import path from 'path';
import { yellow, red, green, dim, bold } from 'colorette';
import { config as loadEnv } from 'dotenv';

import { rootPath } from '@/common/helpers/path.helper';
import { JwtSignOptions } from '@nestjs/jwt';

loadEnv();

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

const EnvSchema = z
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

    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url()).min(1)),
    CORS_METHODS: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(',')
          .map((method) => method.trim())
          .filter(Boolean),
      )
      .pipe(
        z
          .array(
            z.enum([
              'GET',
              'POST',
              'PUT',
              'PATCH',
              'DELETE',
              'OPTIONS',
              'HEAD',
            ]),
          )
          .min(1),
      ),
    CORS_ALLOWED_HEADERS: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(',')
          .map((header) => header.trim())
          .filter(Boolean),
      ),
    CORS_EXPOSED_HEADERS: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(',')
          .map((header) => header.trim())
          .filter(Boolean),
      ),
    CORS_CREDENTIALS: z
      .preprocess((value) => {
        if (value === undefined) return false;

        if (typeof value === 'boolean') return value;
        if (typeof value !== 'string') return value;

        const normalized = value.trim().toLowerCase();

        if (normalized === 'true') return true;
        if (normalized === 'false') return false;

        return value;
      }, z.boolean())
      .default(false),
    CORS_MAX_AGE_SECONDS: z.coerce.number().int().positive(),

    HTTPS_ENABLED: z
      .preprocess((value) => {
        if (value === undefined) return false;

        if (typeof value === 'boolean') return value;
        if (typeof value !== 'string') return value;

        const normalized = value.trim().toLowerCase();

        if (normalized === 'true') return true;
        if (normalized === 'false') return false;

        return value;
      }, z.boolean())
      .default(false),
    HTTPS_KEY_PATH: z.string().optional(),
    HTTPS_CERT_PATH: z.string().optional(),

    COOKIE_SECURE: z
      .preprocess((value) => {
        if (value === undefined) return false;

        if (typeof value === 'boolean') return value;
        if (typeof value !== 'string') return value;

        const normalized = value.trim().toLowerCase();

        if (normalized === 'true') return true;
        if (normalized === 'false') return false;

        return value;
      }, z.boolean())
      .default(false),
    COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),
    COOKIE_PATH: z.string().min(1).default('/'),
    COOKIE_DOMAIN: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value === '' ? undefined : value)),
    REFRESH_COOKIE_NAME: z.string().min(1).default('refresh_token'),
    REFRESH_COOKIE_MAX_AGE_DAYS: z.coerce.number().int().positive().default(7),
    CSRF_COOKIE_NAME: z.string().min(1).default('csrf_token'),
    CSRF_COOKIE_MAX_AGE_MINUTES: z.coerce.number().int().positive().default(15),

    STATIC_SERVE_ENABLED: z
      .preprocess((value) => {
        if (value === undefined) return true;

        if (typeof value === 'boolean') return value;
        if (typeof value !== 'string') return value;

        const normalized = value.trim().toLowerCase();

        if (normalized === 'true') return true;
        if (normalized === 'false') return false;

        return value;
      }, z.boolean())
      .default(true),
    STATIC_ROOT_PATH: z.string().min(1).default('public'),
    STATIC_SERVE_ROOT: z.string().min(1).default('/'),

    UPLOAD_TMP_DIR: z.string().min(1).default('tmp'),

    ALLOWED_HTTP_METHODS: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(',')
          .map((method) => method.trim())
          .filter(Boolean),
      )
      .pipe(
        z
          .array(
            z.enum([
              'GET',
              'POST',
              'PUT',
              'PATCH',
              'DELETE',
              'OPTIONS',
              'HEAD',
            ]),
          )
          .min(1),
      ),

    ALLOWED_CONTENT_TYPES: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(',')
          .map((type) => type.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().min(1)).min(1)),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),

    REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
    REQUEST_BODY_LIMIT_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(1_048_576),

    HEADER_MAX_COUNT: z.coerce.number().int().positive().default(100),
    HEADER_MAX_SINGLE_BYTES: z.coerce.number().int().positive().default(4_096),
    HEADER_MAX_TOTAL_BYTES: z.coerce.number().int().positive().default(8_192),
    HEADER_ALLOW_CHUNKED: z
      .preprocess((value) => {
        if (value === undefined) return false;

        if (typeof value === 'boolean') return value;
        if (typeof value !== 'string') return value;

        const normalized = value.trim().toLowerCase();

        if (normalized === 'true') return true;
        if (normalized === 'false') return false;

        return value;
      }, z.boolean())
      .default(false),

    GLOBAL_THROTTLE_TTL_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .default(60_000),
    GLOBAL_THROTTLE_LIMIT: z.coerce.number().int().positive().default(200),

    DB_HOST: z.string(),
    DB_PORT: z.coerce.number(),
    DB_USER: z.string(),
    DB_PASSWORD: z.string(),
    DB_DATABASE: z.string(),

    DB_SYNC: z
      .preprocess((value) => {
        if (value === undefined) return false;

        if (typeof value === 'boolean') return value;
        if (typeof value !== 'string') return value;

        const normalized = value.trim().toLowerCase();

        if (normalized === 'true') return true;
        if (normalized === 'false') return false;

        return value;
      }, z.boolean())
      .default(false),

    DB_SEED: z
      .preprocess((value) => {
        if (value === undefined) return false;

        if (typeof value === 'boolean') return value;
        if (typeof value !== 'string') return value;

        const normalized = value.trim().toLowerCase();

        if (normalized === 'true') return true;
        if (normalized === 'false') return false;

        return value;
      }, z.boolean())
      .default(false),

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

    POSTMARK_SERVER_TOKEN: z
      .string()
      .min(1, 'POSTMARK_SERVER_TOKEN is required.'),
    POSTMARK_FROM_EMAIL: z.email(
      'POSTMARK_FROM_EMAIL must be a valid email address.',
    ),
    POSTMARK_MESSAGE_STREAM: z
      .enum(['outbound', 'broadcast'])
      .default('outbound'),
  })
  .superRefine((env, ctx) => {
    if (!env.HTTPS_ENABLED) return;

    if (!env.HTTPS_KEY_PATH) {
      ctx.addIssue({
        code: 'custom',
        path: ['HTTPS_KEY_PATH'],
        message: 'HTTPS_KEY_PATH is required when HTTPS_ENABLED is true.',
      });
    }

    if (!env.HTTPS_CERT_PATH) {
      ctx.addIssue({
        code: 'custom',
        path: ['HTTPS_CERT_PATH'],
        message: 'HTTPS_CERT_PATH is required when HTTPS_ENABLED is true.',
      });
    }
  });

function formatIssue(issue: z.core.$ZodIssue): string {
  const field: string = issue.path.join('.') || '(root)';

  const receivedMatch: RegExpMatchArray | null =
    issue.message.match(/received\s"?(.*?)"?$/);
  const received: string | undefined = receivedMatch
    ? receivedMatch[1]
    : undefined;

  const cleaned: string = issue.message
    .replace(/^Invalid input[:, ]*/, '')
    .replace(/^Invalid enum value[:, ]*/, '')
    .replace(/received\s.*$/, '')
    .trim();

  const msg: string = received
    ? `${yellow(field)} → ${cleaned} (received: ${red(`"${received}"`)})`
    : `${yellow(field)} → ${cleaned}`;

  return `  - ${msg}`;
}

function printEnvErrors(issues: z.core.$ZodIssue[]): void {
  const count: number = issues.length;

  process.stdout.write(
    red(
      bold(
        `❌ Environment validation failed (${count} issue${count !== 1 ? 's' : ''})`,
      ),
    ),
  );

  process.stdout.write('\n\n');

  for (const issue of issues) {
    process.stdout.write(formatIssue(issue) + '\n');
  }

  process.stdout.write('\n');
  process.stdout.write(
    dim(green('Fix the fields above and restart the application…\n\n')),
  );
}

let env: z.infer<typeof EnvSchema>;

try {
  env = EnvSchema.parse(process.env);
} catch (err: unknown) {
  if (err instanceof ZodError) {
    printEnvErrors(err.issues);
  } else {
    process.stdout.write(
      red(bold('❌ Unexpected error during environment validation\n\n')),
    );
  }

  process.exit(1);
}

export { env };

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';

export type AppEnv = z.infer<typeof EnvSchema>;
export const APP_ENV = 'APP_ENV' as const;
