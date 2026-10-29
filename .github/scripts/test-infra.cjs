'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const compose = [
  'compose',
  '--project-name',
  'quickapi-nestjs-test',
  '--env-file',
  '.env.test',
  '-f',
  'docker-compose.test.yml',
];
const localTargets = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '3308',
  DB_USER: 'quickapi_test_app',
  DB_PASSWORD: 'quickapi_test_password',
  DB_DATABASE: 'quickapi_test',
  REDIS_HOST: '127.0.0.1',
  REDIS_PORT: '6380',
  REDIS_PASSWORD: 'quickapi_test_redis_password',
};

function assertLocalInfrastructure(environment) {
  for (const [key, expected] of Object.entries(localTargets)) {
    if (environment[key] !== expected)
      throw new Error(
        `${key} does not match the disposable local Compose stack. Use test:e2e directly for CI/custom test services.`,
      );
  }
}

/** Cleanup is installed before startup; even a partial Docker startup is disposable. */
async function runTask(action, args, run) {
  const docker = (...tail) => run('docker', [...compose, ...tail]);
  if (action === 'up') return docker('up', '-d', '--wait');
  if (action === 'down') return docker('down', '--volumes', '--remove-orphans');
  if (action === 'logs') return docker('logs', '--tail=200');
  if (action === 'prepare') {
    const migrationStatus = await run(process.execPath, [
      '-r',
      'ts-node/register',
      '-r',
      'tsconfig-paths/register',
      './node_modules/typeorm/cli.js',
      'migration:run',
      '-d',
      'src/database/typeorm.datasource.ts',
    ]);
    if (migrationStatus !== 0) return migrationStatus;
    return run(process.execPath, [
      '-r',
      'ts-node/register',
      '-r',
      'tsconfig-paths/register',
      'src/database/seed.ts',
    ]);
  }
  if (action === 'safety') return 0;
  if (action !== 'e2e') throw new Error(`Unsupported test action: ${action}`);

  let status = 1;
  let failure;
  try {
    status = await docker('up', '-d', '--wait');
    if (status === 0)
      status = await run(process.execPath, [
        '--no-warnings',
        '--experimental-vm-modules',
        './node_modules/jest/bin/jest.js',
        '--config',
        'test/jest-e2e.json',
        ...args,
      ]);
  } catch (error) {
    failure = error;
  } finally {
    try {
      const cleanup = await docker('down', '--volumes', '--remove-orphans');
      // Preserve the original test/startup failure, but do not hide failed cleanup.
      if (status === 0) status = cleanup;
    } catch (error) {
      if (status === 0) failure ??= error;
    }
  }
  if (failure) throw failure;
  return status;
}

async function main(action, args) {
  if (!['up', 'down', 'logs', 'prepare', 'safety', 'e2e'].includes(action))
    throw new Error(`Unsupported test action: ${action}`);
  process.chdir(root);
  require('ts-node/register');
  require('tsconfig-paths/register');
  require('../../test/load-test-env');
  require('../../test/helpers/database/safety').assertSafeTestDatabase();
  if (['up', 'down', 'logs', 'e2e'].includes(action))
    assertLocalInfrastructure(process.env);

  let active;
  let interrupted = 0;
  const signal = (name, status) => {
    interrupted ||= status;
    active?.kill(name);
  };
  const onInterrupt = () => signal('SIGINT', 130);
  const onTerminate = () => signal('SIGTERM', 143);
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  try {
    const status = await runTask(
      action,
      args,
      (command, commandArgs) =>
        new Promise((resolve, reject) => {
          active = spawn(command, commandArgs, {
            cwd: root,
            env: process.env,
            stdio: 'inherit',
            windowsHide: true,
          });
          active.once('error', reject);
          active.once('close', (code) => {
            active = undefined;
            resolve(interrupted || (code ?? 1));
          });
        }),
    );
    return interrupted || status;
  } finally {
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
  }
}

module.exports = { runTask, assertLocalInfrastructure };
if (require.main === module)
  main(process.argv[2], process.argv.slice(3)).then(
    (status) => {
      process.exitCode = status;
    },
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
