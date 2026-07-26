export type TestDatabaseSafetyOptions = {
  nodeEnv?: string;
  database?: string;
  synchronize?: boolean;
  testDatabaseEnabled?: boolean;
  testDatabase?: string;
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

  return database;
}
