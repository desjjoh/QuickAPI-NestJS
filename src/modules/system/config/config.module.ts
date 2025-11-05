import os from 'os';
import z from 'zod';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppLogger } from '@/modules/logger/services/logger.service';

import { envSchema } from './env.config';

/**
 * Global Configuration Module
 *
 * Loads, validates, and caches environment variables using `@nestjs/config`
 * and Zod schema validation.
 *
 * This module ensures the application fails fast when critical configuration
 * values are missing or invalid, while providing rich contextual logs to
 * assist in debugging startup failures across environments.
 *
 * ---
 * ### Features
 * - Global and cached configuration (`isGlobal: true`, `cache: true`)
 * - `.env` file loading for local development
 * - Strong validation using {@link envSchema}
 * - Consistent, colorized logging through {@link AppLogger}
 * - Includes runtime metadata (PID, hostname, environment, service)
 *
 * ---
 * ### Example Failure Output
 * ```
 * [08:21:41.122] ERROR: ❌ Invalid environment configuration
 * { context: AppConfigModule, env: production, pid: 2143, hostname: api-1 }
 * - DATABASE_URL: Required
 * - REDIS_HOST: Expected string, received number
 * ```
 *
 * The process exits immediately with code `1` after logging all validation issues.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      cache: true,

      /**
       * Validates all loaded environment variables against the Zod schema.
       * Logs structured, contextual errors using the AppLogger and terminates
       * the process on invalid configuration.
       */
      validate: (config: Record<string, unknown>) => {
        const parsed = envSchema.safeParse(config);

        if (!parsed.success) {
          const logger = new AppLogger();
          const zodError = parsed.error as z.ZodError;

          const metadata = {
            context: AppConfigModule.name,
            pid: process.pid,
            hostname: os.hostname(),
          };

          // Primary validation failure log
          logger.error(
            'Invalid environment configuration',
            undefined,
            metadata,
          );

          // Log each individual invalid field
          for (const issue of zodError.issues) {
            logger.error(
              `\t- ${issue.path.join('.')}: ${issue.message}`,
              undefined,
              metadata,
            );
          }

          process.exit(1);
        }

        return parsed.data; // validated, strongly typed config
      },
    }),
  ],
})
export class AppConfigModule {}
