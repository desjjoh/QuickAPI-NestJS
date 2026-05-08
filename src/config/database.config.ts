import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions.js';

function getSslConfig(config: ConfigService): MysqlConnectionOptions['ssl'] {
  const enabled = Boolean(config.get('DB_SSL') === 'true');

  if (!enabled) return undefined;

  const rejectUnauthorized = Boolean(
    config.get('DB_SSL_REJECT_UNAUTHORIZED') === 'true',
  );

  return {
    rejectUnauthorized,
  };
}

export const typeOrmConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],

  useFactory: (config: ConfigService) => ({
    type: 'mysql',
    host: config.get<string>('DB_HOST'),
    port: Number(config.get<string>('DB_PORT')),
    username: config.get<string>('DB_USER'),
    password: config.get<string>('DB_PASSWORD'),
    database: config.get<string>('DB_DATABASE'),
    autoLoadEntities: true,
    synchronize: config.get<string>('DB_SYNC') === 'true',
    logging: false,
    migrationsTableName: 'typeorm_migrations',
    ssl: getSslConfig(config),
    maxQueryExecutionTime: Number(config.get<string>('DB_SLOW_QUERY_LOG_MS')),
    extra: {
      connectionLimit: Number(config.get<string>('DB_POOL_CONNECTION_LIMIT')),
      waitForConnections:
        config.get<string>('DB_POOL_WAIT_FOR_CONNECTIONS') === 'true',
      queueLimit: Number(config.get<string>('DB_POOL_QUEUE_LIMIT')),
      connectTimeout: Number(config.get<string>('DB_CONNECT_TIMEOUT_MS')),
    },
  }),
};
