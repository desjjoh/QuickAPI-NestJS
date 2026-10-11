import {
  mkdtemp,
  mkdir,
  writeFile,
  utimes,
  readdir,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activeUploadPaths } from '@/common/helpers/upload-tracking.helper';
import { imageUploadPolicy } from '@/config/image-upload.config';
import { sweepTemporaryUploads } from './temporary-upload-cleanup.service';

describe('stale upload recovery', () => {
  it('removes only stale owned files, preserving fresh files, active uploads and directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'upload-sweep-'));
    const names = [
      'quickapi-upload-11111111-1111-4111-8111-111111111111.png',
      'quickapi-upload-22222222-2222-4222-8222-222222222222.png',
      'quickapi-upload-33333333-3333-4333-8333-333333333333.png',
      'unrelated.txt',
    ];
    const old = new Date(Date.now() - imageUploadPolicy.staleAfterMs - 1000);
    const active = join(root, names[2]);
    try {
      for (const name of names) await writeFile(join(root, name), 'fixture');
      for (const name of [names[0], names[2], names[3]])
        await utimes(join(root, name), old, old);
      const directory =
        'quickapi-upload-44444444-4444-4444-8444-444444444444.png';
      await mkdir(join(root, directory));
      activeUploadPaths.add(active);
      await sweepTemporaryUploads(root);
      expect((await readdir(root)).sort()).toEqual(
        [names[1], names[2], names[3], directory].sort(),
      );
    } finally {
      activeUploadPaths.delete(active);
      await rm(root, { recursive: true, force: true });
    }
  });
});
