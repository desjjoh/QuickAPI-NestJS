import { assertSafeTestDatabase } from '../../../helpers/database/safety';

describe('test database safety guard', () => {
  const safe = {
    nodeEnv: 'test',
    database: 'disposable_database',
    synchronize: false,
    testDatabaseEnabled: true,
    testDatabase: 'disposable_database',
    host: '127.0.0.1',
    user: 'quickapi_test_app',
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
    [{ ...safe, database: 'quickapi', testDatabase: 'quickapi' }, 'protected'],
    [{ ...safe, host: 'production.example.com' }, 'permitted local/CI host'],
    [{ ...safe, user: 'root' }, 'dedicated non-root'],
    [{ ...safe, user: 'quickapi_app' }, 'dedicated non-root'],
  ])('rejects an unsafe configuration', (options, message) => {
    expect(() => assertSafeTestDatabase(options)).toThrow(message);
  });

  it('supports an explicitly permitted CI database host', () => {
    expect(
      assertSafeTestDatabase({
        ...safe,
        host: 'ci-mysql',
        allowedHosts: 'ci-mysql',
      }),
    ).toBe('disposable_database');
  });
});
