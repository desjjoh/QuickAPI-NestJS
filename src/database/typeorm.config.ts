import { DataSource, DataSourceOptions } from 'typeorm';
import 'reflect-metadata';

import { env } from '@/config/environment.config';

import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { GenderEntity } from '@/modules/domain/library/entities/gender.entity';
import { ImageEntity } from '@/modules/domain/library/entities/image.entity';
import { PermissionEntity } from '@/modules/domain/library/entities/permission.entity';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';
import { UserAddressEntity } from '@/modules/domain/identity/entities/address.entity';
import { UserCredentialsEntity } from '@/modules/domain/identity/entities/credentials.entity';
import { UserProfileEntity } from '@/modules/domain/identity/entities/profile.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';

const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: 'typeorm_migrations',
  entities: [
    // LIBRARY MODULE
    CountryEntity,
    GenderEntity,
    ImageEntity,
    PermissionEntity,
    RoleEntity,
    // IDENTITY MODULE
    UserAddressEntity,
    UserCredentialsEntity,
    UserProfileEntity,
    UserEntity,
  ],
  migrations: ['src/modules/system/database/migrations/*{.ts,.js}'],
  ssl: env.DB_SSL
    ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED }
    : undefined,
  maxQueryExecutionTime: env.DB_SLOW_QUERY_LOG_MS,
  logging: false,
  extra: {
    connectionLimit: env.DB_POOL_CONNECTION_LIMIT,
    waitForConnections: env.DB_POOL_WAIT_FOR_CONNECTIONS,
    queueLimit: env.DB_POOL_QUEUE_LIMIT,
    connectTimeout: env.DB_CONNECT_TIMEOUT_MS,
  },
};

export default new DataSource(dataSourceOptions);
