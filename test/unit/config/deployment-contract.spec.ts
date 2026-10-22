import { readFileSync, readdirSync } from 'node:fs';
import { PATH_METADATA } from '@nestjs/common/constants';
import { PublicApiModule } from '@/modules/api/v1/public/public.module';
import { LibraryController } from '@/modules/api/v1/public/controllers/library.controller';
import { apiV1Routes } from '@/modules/api/v1/v1.module';

const smoke = readFileSync('.github/scripts/ci-smoke.sh', 'utf8');

describe('deployment smoke contracts', () => {
  it('uses matching Alpine releases and excludes package managers from the runtime', () => {
    const dockerfile = readFileSync('Dockerfile', 'utf8');
    const runtime = dockerfile.split('AS runtime')[1];

    expect(dockerfile).toMatch(/ARG ALPINE_VERSION=\d+\.\d+/);
    expect(dockerfile).toContain(
      'FROM node:22-alpine${ALPINE_VERSION} AS prod-deps',
    );
    expect(dockerfile).toContain('FROM alpine:${ALPINE_VERSION} AS runtime');
    expect(runtime).toContain(
      'COPY --from=prod-deps /usr/local/bin/node /usr/local/bin/node',
    );
    expect(runtime).toContain('apk add --no-cache libstdc++');
    expect(runtime).not.toMatch(
      /\b(?:npm|npx|yarn|corepack)\s+(?:ci|install|run)\b/,
    );
    expect(smoke).toContain('for tool in npm npx yarn yarnpkg corepack');
    expect(smoke).toContain('require("sharp")');
    expect(smoke).toContain('require("bcrypt")');
  });

  it('runs production entry points directly with Node in every container topology', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    const commands = (file: string) =>
      [...readFileSync(file, 'utf8').matchAll(/command:\s*\[([^\]]+)\]/g)].map(
        (match) =>
          match[1]
            .split(',')
            .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean),
      );
    const staging = commands('docker-compose.staging.yml');
    const smokeCommands = commands('.github/compose.ci-smoke.yml');
    const migration = pkg.scripts['migration:run:prod'].split(' ');
    const preflight = pkg.scripts['staging:preflight:prod'].split(' ');

    expect(staging).toContainEqual(migration);
    expect(staging).toContainEqual(preflight);
    expect(staging).toContainEqual(pkg.scripts['geoip:update:prod'].split(' '));
    expect(smokeCommands).toContainEqual(migration);
    expect(smokeCommands).toContainEqual(preflight);
    expect(commands('docker-compose.yml')).toContainEqual(migration);
    expect(
      [...staging, ...smokeCommands].some((command) => command[0] === 'npm'),
    ).toBe(false);
    expect(smoke).not.toMatch(/run_migration_cli npm/);
  });

  it('keeps the smoke environment version and browser retry header current', () => {
    const fixture = readFileSync('.github/ci-smoke.env', 'utf8');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      version: string;
    };
    expect(fixture).toContain(`APP_VERSION=${pkg.version}`);
    expect(
      fixture.match(/^CORS_ALLOWED_HEADERS=(.*)$/m)?.[1].split(','),
    ).toContain('Idempotency-Key');
  });

  it('probes the registered startup country endpoint', () => {
    const version = apiV1Routes.find((route) => route.path === 'v1')!;
    const audience = version.children?.find(
      (route) =>
        typeof route !== 'function' && route.module === PublicApiModule,
    );
    if (!audience || typeof audience === 'function')
      throw new Error('Public route missing');
    const controller = Reflect.getMetadata(
      PATH_METADATA,
      LibraryController,
    ) as string;
    const action = Reflect.getMetadata(
      PATH_METADATA,
      LibraryController.prototype.getCountries,
    ) as string;
    const route = `/api/${version.path}/${audience.path}/${controller}/${action}`;
    expect(smoke).toContain(`expect_status 200 ${route}`);
  });

  it('inventories timestamped and descriptively named migrations without declaration files', () => {
    const sourcePattern = smoke.match(
      /find src\/database\/migrations[^\n]+?-name '([^']+)'/,
    )?.[1];
    const imagePattern = smoke.match(
      /find \/app\/dist\/database\/migrations[^\n]+-name '([^']+)'/,
    )?.[1];
    expect(sourcePattern).toBeDefined();
    expect(imagePattern).toBeDefined();
    const matches = (pattern: string, file: string) =>
      new RegExp(
        `^${pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`,
      ).test(file);
    const files = [
      ...readdirSync('src/database/migrations'),
      '1999999999999-new-capability.ts',
    ];
    for (const file of files.filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.d.ts'),
    )) {
      expect(matches(sourcePattern!, file)).toBe(true);
      expect(matches(imagePattern!, file.replace(/\.ts$/, '.js'))).toBe(true);
    }
    expect(smoke).toContain("! -name '*.d.ts'");
  });
});
