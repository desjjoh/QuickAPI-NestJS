import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';

import {
  GeoLiteUpdaterDependencies,
  updateGeoLiteDatabases,
} from './seed-geolite2';

describe('GeoLite2 updater', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'geolite-test-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const environment = () => ({
    IP_LOCATION_DATA_DIR: directory,
    MAXMIND_ACCOUNT_ID: 'account',
    MAXMIND_LICENSE_KEY: 'license',
  });

  const dependencies = (
    overrides: Partial<GeoLiteUpdaterDependencies> = {},
  ): GeoLiteUpdaterDependencies => ({
    download: jest.fn(async () => new Response('archive')),
    extract: jest.fn(async (_archive, target) => {
      const edition = target.endsWith('GeoLite2-City')
        ? 'GeoLite2-City'
        : 'GeoLite2-Country';
      const folder = join(target, `${edition}_test`);
      await mkdir(folder);
      await writeFile(join(folder, `${edition}.mmdb`), `new-${edition}`);
    }),
    validate: jest.fn(async () => undefined),
    ...overrides,
  });

  it('rejects missing credentials', async () => {
    await expect(
      updateGeoLiteDatabases({ IP_LOCATION_DATA_DIR: directory }),
    ).rejects.toThrow('MAXMIND_LICENSE_KEY');
  });

  it('supports local updates with a license key and no account ID', async () => {
    const deps = dependencies();
    await updateGeoLiteDatabases(
      {
        IP_LOCATION_DATA_DIR: directory,
        MAXMIND_LICENSE_KEY: 'license',
      },
      deps,
    );

    expect(deps.download).toHaveBeenCalledTimes(2);
    expect(deps.download).toHaveBeenCalledWith(
      expect.stringContaining('license_key=license'),
      {},
    );
  });

  it('fails when a download fails', async () => {
    const deps = dependencies({
      download: jest.fn(async () => new Response(null, { status: 503 })),
    });
    await expect(updateGeoLiteDatabases(environment(), deps)).rejects.toThrow(
      'Download failed',
    );
  });

  it('fails on a malformed archive', async () => {
    const deps = dependencies({
      extract: jest.fn(async () => {
        throw new Error('bad tar');
      }),
    });
    await expect(updateGeoLiteDatabases(environment(), deps)).rejects.toThrow(
      'bad tar',
    );
  });

  it('rejects an invalid database', async () => {
    const deps = dependencies({
      validate: jest.fn(async () => {
        throw new Error('not mmdb');
      }),
    });
    await expect(updateGeoLiteDatabases(environment(), deps)).rejects.toThrow(
      'Invalid MaxMind database',
    );
  });

  it('atomically replaces databases only after both validate', async () => {
    await writeFile(join(directory, 'GeoLite2-Country.mmdb'), 'old-country');
    await writeFile(join(directory, 'GeoLite2-City.mmdb'), 'old-city');
    await updateGeoLiteDatabases(environment(), dependencies());
    expect(
      await readFile(join(directory, 'GeoLite2-Country.mmdb'), 'utf8'),
    ).toBe('new-GeoLite2-Country');
    expect(await readFile(join(directory, 'GeoLite2-City.mmdb'), 'utf8')).toBe(
      'new-GeoLite2-City',
    );
  });

  it('preserves the last valid databases when an update fails', async () => {
    await writeFile(join(directory, 'GeoLite2-Country.mmdb'), 'old-country');
    await writeFile(join(directory, 'GeoLite2-City.mmdb'), 'old-city');
    const validate = jest
      .fn<Promise<void>, [string]>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('invalid city'));

    await expect(
      updateGeoLiteDatabases(environment(), dependencies({ validate })),
    ).rejects.toThrow('Invalid MaxMind database');
    expect(
      await readFile(join(directory, 'GeoLite2-Country.mmdb'), 'utf8'),
    ).toBe('old-country');
    expect(await readFile(join(directory, 'GeoLite2-City.mmdb'), 'utf8')).toBe(
      'old-city',
    );
  });
});
