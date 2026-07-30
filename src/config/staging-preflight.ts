import { parse } from 'dotenv';
import fs from 'fs';
import net from 'net';
import path from 'path';

import { AppEnv, EnvSchema } from './environment.schema';

const composeRequired = [
  'INGRESS_NETWORK',
  'QUICKAPI_IMAGE',
  'MYSQL_ROOT_PASSWORD',
  'MYSQL_DATABASE',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
] as const;

const secretRequired = [
  'DB_PASSWORD',
  'MYSQL_ROOT_PASSWORD',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'REDIS_PASSWORD',
  'OPERATIONS_TOKEN',
  'MAXMIND_ACCOUNT_ID',
  'MAXMIND_LICENSE_KEY',
  'JWT_SECRET_KEY',
  'REFRESH_SECRET_KEY',
  'CRYPTO_SECRET',
  'POSTMARK_SERVER_TOKEN',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
] as const;

export function parseEnvFile(contents: string): NodeJS.ProcessEnv {
  return parse(contents);
}

function isPlaceholder(value: string): boolean {
  return /^__[A-Z\d_]+__$/.test(value);
}

function assertPublicHttps(name: string, value: string): void {
  const url = new URL(value);

  if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS`);

  const host = url.hostname.toLowerCase();

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === 'example.com' ||
    host.endsWith('.example.com') ||
    host.endsWith('.example')
  )
    throw new Error(`${name} must use a real public hostname`);
}

function isNarrowProxy(value: string): boolean {
  const entries = value.split(',').map((entry) => entry.trim());
  return (
    entries.length > 0 &&
    entries.every((entry) => {
      if (
        !entry ||
        ['true', '*', '0.0.0.0/0', '::/0'].includes(entry.toLowerCase())
      )
        return false;

      const [address, prefix, extra] = entry.split('/');

      if (extra !== undefined || net.isIP(address) === 0) return false;
      if (prefix === undefined) return true;
      if (!/^\d+$/.test(prefix)) return false;

      const bits = Number(prefix);

      return net.isIP(address) === 4
        ? bits >= 8 && bits <= 32
        : bits >= 32 && bits <= 128;
    })
  );
}

function isImmutableImage(value: string): boolean {
  return /@sha256:[a-f\d]{64}$/i.test(value);
}

export function validateStagingEnv(input: NodeJS.ProcessEnv): AppEnv {
  const env = EnvSchema.parse(input);
  const missingCompose = composeRequired.filter((name) => !input[name]?.trim());

  if (missingCompose.length)
    throw new Error(
      `Missing staging deployment variables: ${missingCompose.join(', ')}. ` +
        'Add them to .env.staging (start from .env.staging.example).',
    );

  for (const name of secretRequired) {
    const value = input[name]?.trim() ?? '';

    if (!value) throw new Error(`${name} must not be blank`);

    if (isPlaceholder(value))
      throw new Error(
        `${name} still contains a placeholder; set a real value in the ignored .env.staging file`,
      );
  }

  assertPublicHttps('PUBLIC_API_URL', env.PUBLIC_API_URL);
  assertPublicHttps('PUBLIC_WEB_URL', env.PUBLIC_WEB_URL);

  if (env.CORS_ORIGINS.some((origin) => origin === '*' || origin.includes('*')))
    throw new Error('CORS_ORIGINS must not contain a wildcard');

  for (const origin of env.CORS_ORIGINS)
    assertPublicHttps('CORS_ORIGINS', origin);

  if (!isNarrowProxy(env.TRUST_PROXY))
    throw new Error(
      'TRUST_PROXY must be a narrow IP address or CIDR allowlist',
    );

  if (!isImmutableImage(input.QUICKAPI_IMAGE!))
    throw new Error('QUICKAPI_IMAGE must use an immutable sha256 digest');

  if (env.DB_SYNC !== false)
    throw new Error('DB_SYNC must be false in staging');

  if (input.MYSQL_DATABASE !== env.DB_DATABASE)
    throw new Error('MYSQL_DATABASE must match DB_DATABASE');

  if (input.MYSQL_USER !== env.DB_USER)
    throw new Error('MYSQL_USER must match DB_USER');

  if (input.MYSQL_PASSWORD !== env.DB_PASSWORD)
    throw new Error('MYSQL_PASSWORD must match DB_PASSWORD');

  return env;
}

export function runStagingPreflight(file = '.env.staging'): AppEnv {
  const filename = path.resolve(file);

  if (!fs.existsSync(filename)) throw new Error(`${file} does not exist`);

  const values = parseEnvFile(fs.readFileSync(filename, 'utf8'));

  return validateStagingEnv(values);
}

if (require.main === module) {
  try {
    runStagingPreflight(process.argv[2]);
    console.log('Staging preflight passed.');
  } catch (error) {
    console.error(
      'Staging preflight failed:',
      error instanceof Error ? error.message : error,
    );

    process.exitCode = 1;
  }
}
