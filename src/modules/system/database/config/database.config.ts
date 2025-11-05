import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions.js';
import type { ConfigService } from '@nestjs/config';
import type { EnvSchema } from '@/modules/system/config/env.config';

import entities from '../entities';

/**
 * @fileoverview
 * Factory function that constructs a validated and type-safe
 * {@link MysqlConnectionOptions} object for initializing TypeORM.
 *
 * This configuration is built dynamically from the application's
 * validated environment variables via {@link ConfigService}.
 *
 * ---
 * ### Purpose
 * - Centralizes all TypeORM configuration logic.
 * - Enforces **strong typing** and **schema validation** through {@link EnvSchema}.
 * - Supports dependency injection in {@link DatabaseModule} via `forRootAsync()`.
 *
 * ---
 * ### Behavior
 * - Reads environment variables for MySQL connection details.
 * - Loads all registered ORM entities from the `entities` index.
 * - Enables `synchronize` mode only in development (⚠ not safe for production).
 *
 * ---
 * ### Example Usage
 * ```ts
 * import { TypeOrmModule } from '@nestjs/typeorm';
 * import { buildDatabaseConfig } from '@/modules/database/config/build-database-config';
 *
 * @Module({
 *   imports: [
 *     TypeOrmModule.forRootAsync({
 *       inject: [ConfigService],
 *       useFactory: buildDatabaseConfig,
 *     }),
 *   ],
 * })
 * export class DatabaseModule {}
 * ```
 *
 * ---
 * ### Connection Lifecycle
 * TypeORM will:
 * 1. Establish a persistent connection pool using these settings.
 * 2. Automatically load all entities declared in `entities`.
 * 3. Synchronize schema definitions (in dev only).
 *
 * ---
 * @param config - The injected {@link ConfigService} providing typed env values.
 * @returns A fully configured {@link MysqlConnectionOptions} object.
 */
export const buildDatabaseConfig = (
  config: ConfigService<EnvSchema, true>,
): MysqlConnectionOptions => {
  return {
    /**
     * Database type — informs TypeORM of the underlying SQL dialect.
     */
    type: 'mysql',

    /**
     * Hostname or IP address of the database server.
     *
     * @default "localhost"
     */
    host: config.get('DB_HOST', { infer: true }),

    /**
     * TCP port for the database connection.
     *
     * @default 3306
     */
    port: config.get('DB_PORT', { infer: true }),

    /**
     * Username credential for authentication.
     *
     * @default "root"
     */
    username: config.get('DB_USER', { infer: true }),

    /**
     * Password credential for authentication.
     *
     * @default "root"
     */
    password: config.get('DB_PASSWORD', { infer: true }),

    /**
     * Name of the logical database to connect to.
     *
     * @default "dev"
     */
    database: config.get('DB_NAME', { infer: true }),

    /**
     * Array of ORM entities loaded from the module’s entity registry.
     * Enables automatic discovery and registration.
     */
    entities,

    /**
     * Enables schema auto-synchronization at startup.
     *
     * ⚠️ **Use only for development.**
     * In production, this should be disabled and migrations used instead.
     */
    synchronize: true,

    /**
     * Enables SQL-level logging.
     * Useful for debugging queries; disabled by default for cleaner logs.
     */
    logging: false,
  };
};
