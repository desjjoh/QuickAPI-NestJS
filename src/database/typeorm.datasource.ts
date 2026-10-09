import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

import { env } from '@/config/environment.config';

// PUBLIC LIBRARY
import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { RegionEntity } from '@/modules/domain/library/entities/region.entity';
import { GenderEntity } from '@/modules/domain/library/entities/gender.entity';
import { TimezoneEntity } from '@/modules/domain/library/entities/time-zone.entity';

// USER IDENTITY
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { UserMfaSettingsEntity } from '@/modules/domain/identity/entities/mfa.entity';
import { PermissionEntity } from '@/modules/domain/library/entities/permission.entity';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';
import { UserAddressEntity } from '@/modules/domain/identity/entities/address.entity';
import { UserProfileEntity } from '@/modules/domain/identity/entities/profile.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { AccountStatusEntity } from '@/modules/domain/library/entities/accountstatus.entity';
import { AccountTokenEntity } from '@/modules/domain/identity/entities/account-token.entity';
import { UserPhoneEntity } from '@/modules/domain/identity/entities/phone.entity';
import { RegistrationTokenEntity } from '@/modules/domain/identity/entities/registration-token.entity';

// MEDIA
import { ImageEntity } from '@/modules/domain/media/entities/image.entity';

// AUDIT EVENTS
import { AuditEventEntity } from '@/modules/domain/audit/entities/audit-event.entity';

// ARTICLES
import { ArticleEntity } from '@/modules/domain/articles/entities/article.entity';
import { ArticleStatusEntity } from '@/modules/domain/articles/entities/articleStatus.entity';
import { IdempotencyEntity } from '@/modules/system/idempotency/entities/idempotency.entity';

const sourceMigrationDirectory = path.resolve(
  process.cwd(),
  'src/database/migrations',
);

const migrationDirectory = existsSync(sourceMigrationDirectory)
  ? sourceMigrationDirectory
  : path.resolve(process.cwd(), 'dist/database/migrations');

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
    RegionEntity,
    TimezoneEntity,
    GenderEntity,
    PermissionEntity,
    RoleEntity,
    AccountStatusEntity,
    // MEDIA MODULE
    ImageEntity,
    // IDENTITY MODULE
    UserAddressEntity,
    UserPhoneEntity,
    UserMfaSettingsEntity,
    UserSessionEntity,
    UserProfileEntity,
    UserEntity,
    AccountTokenEntity,
    RegistrationTokenEntity,
    // AUDIT MODULE
    AuditEventEntity,
    // ARTICLE MODULE
    ArticleEntity,
    ArticleStatusEntity,
    IdempotencyEntity,
  ],
  migrations: [path.join(migrationDirectory, '*{.ts,.js}')],
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
