import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions.js';

import { env } from '@/config/environment.config';

function getSslConfig(): MysqlConnectionOptions['ssl'] {
  if (!env.DB_SSL) return undefined;

  return {
    rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
  };
}

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'mysql',

  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,

  autoLoadEntities: true,
  synchronize: env.DB_SYNC,

  logging: false,
  migrationsTableName: 'typeorm_migrations',
  ssl: getSslConfig(),
  maxQueryExecutionTime: env.DB_SLOW_QUERY_LOG_MS,

  extra: {
    connectionLimit: env.DB_POOL_CONNECTION_LIMIT,
    waitForConnections: env.DB_POOL_WAIT_FOR_CONNECTIONS,
    queueLimit: env.DB_POOL_QUEUE_LIMIT,
    connectTimeout: env.DB_CONNECT_TIMEOUT_MS,
  },
};
