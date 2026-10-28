export type TestDatabaseSafetyOptions = {
  nodeEnv?: string;
  database?: string;
  synchronize?: boolean;
  testDatabaseEnabled?: boolean;
  testDatabase?: string;
  host?: string;
  user?: string;
  allowedHosts?: string;
};

/**
 * This guard must run before any destructive database statement. Tests must
 * explicitly opt in and the active database must exactly match the separately
 * configured test database; no naming convention is used as a safety signal.
 */
export function assertSafeTestDatabase({
  nodeEnv = process.env.NODE_ENV,
  database = process.env.DB_DATABASE,
  synchronize = process.env.DB_SYNC === 'true',
  testDatabaseEnabled = process.env.TEST_DB_ENABLED === 'true',
  testDatabase = process.env.TEST_DB_DATABASE,
  host = process.env.DB_HOST,
  user = process.env.DB_USER,
  allowedHosts = process.env.TEST_DB_ALLOWED_HOSTS ?? '',
}: TestDatabaseSafetyOptions = {}): string {
  if (nodeEnv !== 'test') {
    throw new Error('Database test helpers require NODE_ENV=test.');
  }

  if (!testDatabaseEnabled) {
    throw new Error(
      'Destructive test database operations require TEST_DB_ENABLED=true.',
    );
  }

  if (!testDatabase) {
    throw new Error('TEST_DB_DATABASE must identify the disposable database.');
  }

  if (!database || database !== testDatabase) {
    throw new Error(
      `Active DB_DATABASE "${database ?? ''}" does not match TEST_DB_DATABASE "${testDatabase}".`,
    );
  }

  if (synchronize) {
    throw new Error(
      'DB_SYNC must be false; tests exercise deployment migrations.',
    );
  }

  const protectedNames = new Set([
    'quickapi',
    'mysql',
    'sys',
    'information_schema',
    'performance_schema',
    'dev',
    'development',
    'stage',
    'staging',
    'prod',
    'production',
  ]);
  if (protectedNames.has(database.trim().toLowerCase()))
    throw new Error('The selected database is protected from test resets.');

  const permittedHosts = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'mysql-test',
    ...allowedHosts
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  ]);
  if (!host || !permittedHosts.has(host.trim().toLowerCase()))
    throw new Error('Test database host is not a permitted local/CI host.');
  if (!user || ['root', 'quickapi_app'].includes(user.trim().toLowerCase()))
    throw new Error('Tests require a dedicated non-root database user.');

  return database;
}

/** Redis tests may remove queues/jobs; they need the same host boundary as SQL. */
export function assertSafeTestRedis(
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const allowed = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'redis-test',
    ...(environment.TEST_REDIS_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  ]);
  if (
    environment.NODE_ENV !== 'test' ||
    !allowed.has(environment.REDIS_HOST?.trim().toLowerCase() ?? '')
  )
    throw new Error('Test Redis host is not a permitted local/CI host.');
}
