import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const composeFile = resolve('docker-compose.staging.yml');
const envFile = resolve('.env.staging');
const composeSource = readFileSync(composeFile, 'utf8');

const serviceSource = (name) => {
  const match = composeSource.match(
    new RegExp(
      `^  ${name}:\\r?\\n([\\s\\S]*?)(?=^  [a-zA-Z0-9_-]+:|^volumes:)`,
      'm',
    ),
  );

  if (!match) throw new Error(`Compose source has no ${name} service.`);

  return match[1];
};

const usesOnlyStagingEnvFile = (name) =>
  /^    env_file:\s*\r?\n      - \.env\.staging\s*$/m.test(serviceSource(name));

if (!usesOnlyStagingEnvFile('redis')) {
  throw new Error('Staging Redis must use only .env.staging as its env_file.');
}

if (!usesOnlyStagingEnvFile('api')) {
  throw new Error(
    'Staging API and Redis must use the same .env.staging source.',
  );
}

// Do not resolve env_file entries: this keeps secret values out of both the
// captured configuration and normal preflight output.
const rendered = execFileSync(
  'docker',
  [
    'compose',
    '--env-file',
    envFile,
    '-f',
    composeFile,
    'config',
    '--no-env-resolution',
    '--format',
    'json',
  ],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
);
const config = JSON.parse(rendered);
const redis = config.services?.redis;

if (!redis)
  throw new Error('Rendered Compose configuration has no redis service.');
if (redis.ports?.length)
  throw new Error('Staging Redis must not publish any host ports.');

const networks = Array.isArray(redis.networks)
  ? redis.networks
  : Object.keys(redis.networks ?? {});
if (networks.length !== 1 || networks[0] !== 'private') {
  throw new Error('Staging Redis must belong only to the private network.');
}

if (!config.networks?.private?.internal) {
  throw new Error('The private network must be internal.');
}

process.stdout.write(
  'Staging preflight passed: sanitized Redis Compose topology is valid.\n',
);
