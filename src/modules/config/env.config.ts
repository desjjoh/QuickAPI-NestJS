import { z } from 'zod';

/**
 * @fileoverview
 * Defines and validates the application's environment configuration
 * using a strongly typed {@link zod} schema.
 *
 * This schema ensures that all critical environment variables are
 * present, correctly typed, and fall within valid ranges before
 * the application bootstraps.
 *
 * ---
 * ### Purpose
 * - Provides **type-safe**, **runtime-validated** configuration.
 * - Prevents startup with invalid or missing environment variables.
 * - Supports `.env` file loading via Nest’s `ConfigModule`.
 *
 * ---
 * ### Validation Behavior
 * - Fails fast if any variable is missing or incorrectly typed.
 * - Automatically coerces numeric and boolean values from strings.
 * - Supplies sane defaults for development environments.
 *
 * ---
 * ### Example `.env` File
 * ```bash
 * NODE_ENV=development
 * PORT=3000
 * LOG_LEVEL=debug
 * ```
 */
export const envSchema = z.object({
  /**
   * Node.js runtime environment.
   *
   * Determines global behavior such as logging verbosity and
   * error reporting. Defaults to `'development'` if unset.
   *
   * @example "production"
   * @enum {('development' | 'production' | 'test')}
   */
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  /**
   * HTTP server port.
   *
   * Automatically coerced from string to number.
   * Must be an integer within the valid TCP port range (1–65535).
   *
   * @example 8080
   * @minimum 1
   * @maximum 65535
   */
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  /**
   * Logging verbosity level for the {@link AppLogger}.
   *
   * Controls which log messages are emitted globally.
   *
   * @example "debug"
   * @enum {('debug' | 'info' | 'warn' | 'error')}
   */
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  /**
   * Hostname or IP address of the MySQL database.
   *
   * @example "127.0.0.1"
   */
  DB_HOST: z.string().default('localhost'),

  /**
   * TCP port of the MySQL database.
   *
   * @example 3306
   * @minimum 1
   * @maximum 65535
   */
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),

  /**
   * Username for authenticating with the MySQL database.
   *
   * @example "root"
   */
  DB_USER: z.string().default('root'),

  /**
   * Password for authenticating with the MySQL database.
   *
   * @example "root"
   * @note Use a strong password in production environments.
   */
  DB_PASSWORD: z.string().default('root'),

  /**
   * Name of the database schema to connect to.
   *
   * @example "quickapi"
   */
  DB_NAME: z.string().default('dev'),
});

/**
 * Inferred TypeScript type representing the validated environment schema.
 *
 * Can be used to provide strong typing for injected configuration objects
 * or anywhere the parsed environment is referenced.
 *
 * @example
 * ```ts
 * import { ConfigService } from '@nestjs/config';
 * import type { EnvSchema } from '@/config/env.config';
 *
 * constructor(private readonly config: ConfigService<EnvSchema, true>) {}
 * ```
 */
export type EnvSchema = z.infer<typeof envSchema>;
