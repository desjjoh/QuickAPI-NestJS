import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions.js';
import type { ConfigService } from '@nestjs/config';
import type { EnvSchema } from '@/modules/system/config/env.config';

import entities from '../entities';

export const buildDatabaseConfig = (
  config: ConfigService<EnvSchema, true>,
): MysqlConnectionOptions => {
  return {
    type: 'mysql',
    host: config.get('DB_HOST', { infer: true }),
    port: config.get('DB_PORT', { infer: true }),
    username: config.get('DB_USER', { infer: true }),
    password: config.get('DB_PASSWORD', { infer: true }),
    database: config.get('DB_NAME', { infer: true }),
    entities,
    synchronize: true,
    logging: false,
  };
};
