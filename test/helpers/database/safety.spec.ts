import { assertSafeTestDatabase } from './safety';

describe('test database safety guard', () => {
  const safe = {
    nodeEnv: 'test',
    database: 'disposable_database',
    synchronize: false,
    testDatabaseEnabled: true,
    testDatabase: 'disposable_database',
  } as const;

  it('accepts an explicitly named test database with synchronization disabled', () => {
    expect(assertSafeTestDatabase(safe)).toBe('disposable_database');
  });

  it.each([
    [{ ...safe, nodeEnv: 'development' }, 'NODE_ENV=test'],
    [{ ...safe, testDatabaseEnabled: false }, 'TEST_DB_ENABLED=true'],
    [{ ...safe, testDatabase: '' }, 'TEST_DB_DATABASE must identify'],
    [{ ...safe, database: 'application_database' }, 'does not match'],
    [{ ...safe, synchronize: true }, 'DB_SYNC must be false'],
  ])('rejects an unsafe configuration', (options, message) => {
    expect(() => assertSafeTestDatabase(options)).toThrow(message);
  });
});
