import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();

describe('isolated test environment', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'nestjs-test-env-'));
    copyFileSync(resolve(root, '.env.test'), join(directory, '.env.test'));
    copyFileSync(
      resolve(root, 'package.json'),
      join(directory, 'package.json'),
    );
    writeFileSync(
      join(directory, '.env'),
      'LOCAL_ONLY_SETTING=development-file-loaded\nDB_DATABASE=quickapi\n',
    );
  });

  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  function inspect(overrides: NodeJS.ProcessEnv = {}) {
    const environment = { ...process.env };
    for (const key of Object.keys(environment))
      if (key.startsWith('TEST_DB_') || key.startsWith('TEST_REDIS_'))
        delete environment[key];

    return spawnSync(
      process.execPath,
      [
        '-r',
        resolve(root, 'node_modules/ts-node/register'),
        '-e',
        `
      require(${JSON.stringify(resolve(root, 'node_modules/tsconfig-paths'))}).register({baseUrl:${JSON.stringify(root)},paths:{'@/*':['src/*']}});
      require(${JSON.stringify(resolve(root, 'test/load-test-env'))});
      const {env}=require(${JSON.stringify(resolve(root, 'src/config/environment.config'))});
      require(${JSON.stringify(resolve(root, 'test/helpers/database/safety'))}).assertSafeTestDatabase();
      console.log(JSON.stringify({database:env.DB_DATABASE,port:env.DB_PORT,user:env.DB_USER,redisPort:env.REDIS_PORT,redisPassword:env.REDIS_PASSWORD,canary:process.env.LOCAL_ONLY_SETTING??null,postmark:env.POSTMARK_ENABLED}));
    `,
      ],
      {
        cwd: directory,
        env: {
          ...environment,
          TS_NODE_PROJECT: resolve(root, 'tsconfig.json'),
          DB_DATABASE: 'quickapi',
          DB_PORT: '3307',
          DB_USER: 'quickapi_app',
          REDIS_PORT: '6379',
          REDIS_PASSWORD: 'development-password',
          ...overrides,
        },
        encoding: 'utf8',
      },
    );
  }

  it('ignores development files and inherited development connections', () => {
    const result = inspect();
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      database: 'quickapi_test',
      port: 3308,
      user: 'quickapi_test_app',
      redisPort: 6380,
      redisPassword: 'quickapi_test_redis_password',
      canary: null,
      postmark: false,
    });
  });

  it('preserves explicitly test-scoped CI overrides, including an empty Redis password', () => {
    const result = inspect({
      TEST_DB_DATABASE: 'e2e_shard_1',
      TEST_DB_PORT: '3306',
      TEST_DB_USER: 'quickapi_test',
      TEST_REDIS_PORT: '6379',
      TEST_REDIS_PASSWORD: '',
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      database: 'e2e_shard_1',
      port: 3306,
      user: 'quickapi_test',
      redisPort: 6379,
      redisPassword: '',
    });
  });

  it.each([
    { TEST_DB_ENABLED: 'false' },
    { TEST_DB_DATABASE: 'quickapi' },
    { TEST_DB_HOST: 'production.example.com' },
    { TEST_DB_USER: 'root' },
    { TEST_DB_PASSWORD: '' },
    { TEST_REDIS_HOST: 'production.example.com' },
  ])('fails closed for unsafe test configuration: %j', (overrides) => {
    const result = inspect(overrides);
    expect(result.status).not.toBe(0);
  });
});
