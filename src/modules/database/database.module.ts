import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { AppLogger } from '@/modules/logger/services/logger.service';
import { buildDatabaseConfig } from './config/database.config';
import type { EnvSchema } from '@/modules/config/env.config';

/**
 * @fileoverview
 * Provides centralized database initialization for the application.
 *
 * The {@link DatabaseModule} configures and bootstraps the TypeORM
 * connection using environment variables validated by {@link EnvSchema}.
 * It uses Nest’s asynchronous factory pattern to ensure that configuration
 * and logging are available before database initialization.
 *
 * ---
 * ### Purpose
 * - Establish a single source of truth for database connectivity.
 * - Enforce **typed**, **validated**, and **observable** startup behavior.
 * - Integrate with {@link AppLogger} for transparent connection lifecycle logs.
 *
 * ---
 * ### Example Log Output
 * ```
 * [12:15:43.129] INFO: Connecting to MySQL → root@127.0.0.1:3306/quickapi { context: DatabaseModule }
 * ```
 *
 * ---
 * ### Example Usage
 * ```ts
 * import { DatabaseModule } from '@/modules/database/database.module';
 *
 * @Module({
 *   imports: [DatabaseModule],
 * })
 * export class AppModule {}
 * ```
 *
 * ---
 * ### Notes
 * - The actual connection options are built in {@link buildDatabaseConfig}.
 * - The `synchronize` option in dev mode automatically syncs entities to schema.
 * - In production, disable `synchronize` and use migrations instead.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      /**
       * Dependencies injected into the async configuration factory.
       * Ensures that both validated environment configuration and
       * logging services are available at runtime.
       */
      inject: [ConfigService, AppLogger],

      /**
       * Factory function constructing a fully resolved TypeORM config.
       * Logs connection metadata before establishing the connection.
       */
      useFactory: (
        config: ConfigService<EnvSchema, true>,
        logger: AppLogger,
      ) => {
        const dbConfig = buildDatabaseConfig(config);
        const { host, port, username, database } = dbConfig;

        logger.log(
          `Connecting to MySQL → ${username}@${host}:${port}/${database}`,
          { context: DatabaseModule.name },
        );

        return dbConfig;
      },
    }),
  ],
})
export class DatabaseModule {}
