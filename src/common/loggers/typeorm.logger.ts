// src/modules/system/database/typeorm.logger.ts
import { Logger } from 'typeorm';
import { logger } from '@/config/logger.config';

export class TypeOrmPinoLogger implements Logger {
  logQuery(query: string, parameters?: unknown[]) {
    logger.debug(`QUERY: ${query} -- [${parameters}]`);
  }

  logQueryError(error: string, query: string) {
    logger.error(`QUERY ERROR: ${error} -- ${query}`);
  }

  logQuerySlow(time: number, query: string) {
    logger.warn(`SLOW QUERY (${time}ms): ${query}`);
  }

  logSchemaBuild(message: string) {
    logger.debug(`SCHEMA: ${message}`);
  }

  logMigration(message: string) {
    logger.info(`MIGRATION: ${message}`);
  }

  log(level: 'log' | 'info' | 'warn', message: string) {
    logger[level](message);
  }
}
