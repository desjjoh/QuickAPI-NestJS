import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { AppLogger } from '@/modules/system/logger/services/logger.service';
import { buildDatabaseConfig } from './config/database.config';
import type { EnvSchema } from '@/modules/system/config/env.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService, AppLogger],

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
