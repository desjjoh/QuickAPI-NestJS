import { readFileSync, readdirSync } from 'node:fs';
import { PATH_METADATA } from '@nestjs/common/constants';
import { PublicApiModule } from '@/modules/api/v1/public/public.module';
import { LibraryController } from '@/modules/api/v1/public/controllers/library.controller';
import { apiV1Routes } from '@/modules/api/v1/v1.module';

const smoke = readFileSync('.github/scripts/ci-smoke.sh', 'utf8');

describe('deployment smoke contracts', () => {
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
