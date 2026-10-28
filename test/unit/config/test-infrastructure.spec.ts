import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';

describe('local infrastructure isolation contracts', () => {
  const development = readFileSync('docker-compose.yml', 'utf8');
  const tests = readFileSync('docker-compose.test.yml', 'utf8');
  const environment = parse(readFileSync('.env.test'));

  it('keeps test connection settings out of application environment examples', () => {
    for (const file of ['.env.example', '.env.staging.example']) {
      expect(readFileSync(file, 'utf8')).not.toMatch(
        /^TEST_(?:DB|REDIS)_\w+=/m,
      );
    }
  });

  it('namespaces development and tests without global container-name collisions', () => {
    expect(development).toMatch(/^name: quickapi-nestjs-dev$/m);
    expect(tests).toMatch(/^name: quickapi-nestjs-test$/m);
    expect(development + tests).not.toMatch(/container_name:/);
  });

  it('uses separate loopback-only ports and disposable test storage', () => {
    expect(development).toContain('127.0.0.1:3307:3306');
    expect(development).toContain('127.0.0.1:6379:6379');
    expect(tests).toContain(`127.0.0.1:${environment.TEST_DB_PORT}:3306`);
    expect(tests).toContain(`127.0.0.1:${environment.TEST_REDIS_PORT}:6379`);
    expect(tests.match(/tmpfs:/g)).toHaveLength(2);
    expect(tests).not.toMatch(/volumes:/);
    expect(tests).toContain('--appendonly no');
  });

  it('keeps the dedicated test credentials synchronized with Compose', () => {
    expect(tests).toContain(`MYSQL_DATABASE: ${environment.TEST_DB_DATABASE}`);
    expect(tests).toContain(`MYSQL_USER: ${environment.TEST_DB_USER}`);
    expect(tests).toContain(`MYSQL_PASSWORD: ${environment.TEST_DB_PASSWORD}`);
    expect(tests).toContain(
      `REDIS_PASSWORD: ${environment.TEST_REDIS_PASSWORD}`,
    );
    expect(environment.TEST_DB_ENABLED).toBe('true');
    expect(environment.TEST_DB_USER).not.toBe('quickapi_app');
  });
});
