import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { config as loadEnv } from 'dotenv';
import * as maxmind from 'maxmind';

// Keep the standalone development command consistent with the application:
// `npm run geoip:update` should read credentials from the repository's .env.
loadEnv({ quiet: true });

const editions = ['GeoLite2-Country', 'GeoLite2-City'] as const;

export interface GeoLiteUpdaterDependencies {
  download: (url: string, headers: Record<string, string>) => Promise<Response>;
  extract: (archive: string, directory: string) => Promise<void>;
  validate: (database: string) => Promise<void>;
}

async function extractArchive(
  archive: string,
  directory: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', ['-xzf', archive, '-C', directory]);
    child.on('error', () =>
      reject(
        new Error('Unable to run tar; install a tar-compatible extractor.'),
      ),
    );
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Invalid MaxMind archive (tar exited ${code}).`)),
    );
  });
}

const defaults: GeoLiteUpdaterDependencies = {
  download: (url, headers) => fetch(url, { headers }),
  extract: extractArchive,
  validate: async (database) => {
    await maxmind.open(database);
  },
};

export async function updateGeoLiteDatabases(
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: GeoLiteUpdaterDependencies = defaults,
): Promise<void> {
  const dataDir = environment.IP_LOCATION_DATA_DIR || 'data/geoip';
  const key = environment.MAXMIND_LICENSE_KEY;
  const account = environment.MAXMIND_ACCOUNT_ID;

  if (!key)
    throw new Error(
      'MAXMIND_LICENSE_KEY is required to seed GeoLite2 databases.',
    );

  await mkdir(dataDir, { recursive: true });
  const workspace = await mkdtemp(join(dataDir, '.geolite-update-'));
  const prepared = new Map<string, string>();
  const backups = new Map<string, string>();
  const replaced = new Set<string>();

  try {
    for (const edition of editions) {
      console.log(`Downloading ${edition}.mmdb...`);
      const archive = join(workspace, `${edition}.tar.gz`);
      const extracted = join(workspace, edition);
      await mkdir(extracted);
      const url = `https://download.maxmind.com/app/geoip_download?edition_id=${edition}&license_key=${encodeURIComponent(key)}&suffix=tar.gz`;
      const headers: Record<string, string> = account
        ? {
            Authorization: `Basic ${Buffer.from(`${account}:${key}`).toString('base64')}`,
          }
        : {};
      const response = await dependencies.download(url, headers);

      if (!response.ok || !response.body)
        throw new Error(
          `Download failed for ${edition}: HTTP ${response.status}.`,
        );

      await pipeline(response.body as never, createWriteStream(archive));
      await dependencies.extract(archive, extracted);
      const folder = (await readdir(extracted)).find((entry) =>
        entry.startsWith(edition),
      );
      const source = folder ? join(extracted, folder, `${edition}.mmdb`) : '';
      if (!source)
        throw new Error(
          `Invalid archive for ${edition}: expected .mmdb file was not found.`,
        );

      try {
        await dependencies.validate(source);
      } catch {
        throw new Error(`Invalid MaxMind database for ${edition}.`);
      }
      prepared.set(edition, source);
    }

    try {
      for (const edition of editions) {
        const destination = join(dataDir, `${edition}.mmdb`);
        const backup = join(workspace, `${edition}.previous.mmdb`);
        try {
          await rename(destination, backup);
          backups.set(edition, backup);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        await rename(prepared.get(edition)!, destination);
        replaced.add(edition);
      }
    } catch (error) {
      for (const edition of editions) {
        const destination = join(dataDir, `${edition}.mmdb`);
        if (replaced.has(edition)) await rm(destination, { force: true });
        if (backups.has(edition)) {
          await rename(backups.get(edition)!, destination);
        }
      }
      throw error;
    }

    console.log(`GeoLite2 databases ready in ${dataDir}.`);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

if (require.main === module) {
  updateGeoLiteDatabases().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
