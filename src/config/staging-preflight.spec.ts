import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  parseEnvFile,
  runStagingPreflight,
  validateStagingEnv,
} from './staging-preflight';

const valid = (): NodeJS.ProcessEnv => ({
  ...process.env,
  NODE_ENV: 'production',
  PUBLIC_API_URL: 'https://api.staging.acme.test',
  PUBLIC_WEB_URL: 'https://staging.acme.test',
  CORS_ORIGINS: 'https://staging.acme.test',
  DB_HOST: 'mysql',
  DB_PORT: '3306',
  DB_USER: 'quickapi',
  DB_PASSWORD: 'database-secret',
  DB_DATABASE: 'quickapi_staging',
  DB_SYNC: 'false',
  REDIS_HOST: 'redis',
  REDIS_PORT: '6379',
  REDIS_PASSWORD: 'redis-secret',
  OPERATIONS_TOKEN: 'operations-token-that-is-at-least-32-chars',
  METRICS_ENABLED: 'true',
  BULL_BOARD_ENABLED: 'false',
  JWT_SECRET_KEY: 'a'.repeat(64),
  REFRESH_SECRET_KEY: 'b'.repeat(64),
  CRYPTO_SECRET: 'c'.repeat(64),
  TRUST_PROXY: '172.20.0.0/24',
  INGRESS_NETWORK: 'staging-ingress',
  QUICKAPI_IMAGE: 'registry.acme.test/quickapi:git-abcdef123456',
  MAXMIND_ACCOUNT_ID: '123456',
  MAXMIND_LICENSE_KEY: 'maxmind-secret',
});

function rejects(change: Record<string, string>, message: RegExp): void {
  expect(() => validateStagingEnv({ ...valid(), ...change })).toThrow(message);
}

describe('staging preflight', () => {
  it('accepts a secure staging configuration', () => {
    expect(validateStagingEnv(valid()).DB_SYNC).toBe(false);
  });

  it('parses quoted values and inline comments using dotenv rules', () => {
    expect(
      parseEnvFile(
        'PASSWORD="value with spaces" # comment\nTOKEN=value#literal\n',
      ),
    ).toEqual({ PASSWORD: 'value with spaces', TOKEN: 'value' });
  });

  it('validates only the staging file instead of ambient process values', () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'staging-preflight-'),
    );
    const filename = path.join(directory, '.env.staging');
    const input = valid();

    fs.writeFileSync(
      filename,
      Object.entries(input)
        .filter((entry): entry is [string, string] => entry[1] !== undefined)
        .map(([name, value]) => `${name}=${value}`)
        .join('\n'),
    );

    const previous = process.env.INGRESS_NETWORK;
    process.env.INGRESS_NETWORK = '';
    try {
      expect(runStagingPreflight(filename).DB_DATABASE).toBe(
        'quickapi_staging',
      );
    } finally {
      if (previous === undefined) delete process.env.INGRESS_NETWORK;
      else process.env.INGRESS_NETWORK = previous;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    [
      { INGRESS_NETWORK: '', QUICKAPI_IMAGE: '' },
      /Missing staging deployment variables: INGRESS_NETWORK, QUICKAPI_IMAGE/,
    ],
    [{ REDIS_PASSWORD: '' }, /REDIS_PASSWORD/],
    [{ OPERATIONS_TOKEN: '' }, /OPERATIONS_TOKEN/],
    [
      { REDIS_PASSWORD: '__REPLACE_REDIS_PASSWORD_BEFORE_DEPLOYMENT__' },
      /placeholder/,
    ],
    [
      { PUBLIC_API_URL: 'http://api.staging.acme.test' },
      /PUBLIC_API_URL must use HTTPS/,
    ],
    [{ PUBLIC_WEB_URL: 'https://localhost' }, /real public hostname/],
    [{ CORS_ORIGINS: '*' }, /CORS_ORIGINS/],
    [{ TRUST_PROXY: '0.0.0.0/0' }, /TRUST_PROXY/],
    [{ TRUST_PROXY: 'true' }, /TRUST_PROXY/],
    [{ QUICKAPI_IMAGE: 'quickapi:staging' }, /commit-specific tag/],
    [{ DB_SYNC: 'true' }, /DB_SYNC/],
  ])('rejects unsafe staging input %#', (change, message) =>
    rejects(change, message),
  );
});
