import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { env } from '@/config/environment.config';

const dataDir = env.IP_LOCATION_DATA_DIR;
const key = env.MAXMIND_LICENSE_KEY;
const account = env.MAXMIND_ACCOUNT_ID;
const editions = ['GeoLite2-Country', 'GeoLite2-City'];

async function extract(archive: string, directory: string): Promise<void> {
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

async function main(): Promise<void> {
  if (!key)
    throw new Error(
      'MAXMIND_LICENSE_KEY is required to seed GeoLite2 databases.',
    );

  await mkdir(dataDir, { recursive: true });

  for (const edition of editions) {
    const destination = join(dataDir, `${edition}.mmdb`);
    const existing =
      existsSync(destination) && (await stat(destination)).size > 0;

    console.log(
      `${existing ? 'Updating' : 'Installing'} ${basename(destination)}...`,
    );

    const archive = join(dataDir, `${edition}.tar.gz`);
    const url = `https://download.maxmind.com/app/geoip_download?edition_id=${edition}&license_key=${encodeURIComponent(key)}&suffix=tar.gz`;

    const response = await fetch(url, {
      headers: account
        ? {
            Authorization: `Basic ${Buffer.from(`${account}:${key}`).toString('base64')}`,
          }
        : {},
    });

    if (!response.ok || !response.body)
      throw new Error(
        `Download failed for ${edition}: HTTP ${response.status}. Check MaxMind credentials and database availability.`,
      );

    await pipeline(response.body as never, createWriteStream(archive));

    const temp = join(dataDir, `.extract-${edition}`);

    await rm(temp, { recursive: true, force: true });
    await mkdir(temp);
    await extract(archive, temp);

    const folders = await readdir(temp);
    const folder = folders.find((entry) => entry.startsWith(edition));
    const source = folder ? join(temp, folder, `${edition}.mmdb`) : '';

    if (!source || !existsSync(source))
      throw new Error(
        `Invalid archive for ${edition}: expected .mmdb file was not found.`,
      );

    await rename(source, destination);
    await rm(temp, { recursive: true, force: true });
    await rm(archive, { force: true });
  }

  for (const edition of editions)
    if (!existsSync(join(dataDir, `${edition}.mmdb`)))
      throw new Error(
        `Seeding failed: ${edition}.mmdb is unavailable in ${dataDir}.`,
      );

  console.log(`GeoLite2 databases ready in ${dataDir}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);

  process.exitCode = 1;
});
