import { mkdtemp, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ImageRepository } from '../repositories/image.repository';
import { StorageService } from '@/modules/system/storage/types/storage.types';
import { ImageEntity } from '../entities/image.entity';
import { ImageService } from './image.service';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'image-service-'));
  const path = join(dir, 'generated.png');
  await writeFile(path, png);
  return {
    fieldname: 'file',
    originalname: 'photo.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: png.length,
    destination: dir,
    filename: 'generated.png',
    path,
    buffer: png,
  } as Express.Multer.File;
}

describe('ImageService', () => {
  const repo = {
    findById: jest.fn(),
    createImage: jest.fn(),
    updateImage: jest.fn(),
    deleteImage: jest.fn(),
  };
  const storage = { putObject: jest.fn(), deleteObject: jest.fn() };
  beforeEach(() => jest.clearAllMocks());
  const service = () =>
    new ImageService(
      repo as unknown as ImageRepository,
      storage as unknown as StorageService,
    );

  it('throws for a missing reference record', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service().findById('missing')).rejects.toThrow(
      'Image with ID "missing" was not found.',
    );
  });
  it('persists extracted metadata after upload and removes the temporary file', async () => {
    const file = await fixture();
    storage.putObject.mockResolvedValue({});
    repo.createImage.mockImplementation(async (value) => ({
      id: '1',
      ...value,
    }));
    await expect(
      service().create({ file, folder: 'avatars', alt_text: 'portrait' }),
    ).resolves.toEqual(
      expect.objectContaining({ width: 1, height: 1, alt_text: 'portrait' }),
    );
    expect(storage.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'avatars/generated.png',
        body: png,
        contentType: 'image/png',
        metadata: { filename: 'generated.png', originalName: 'photo.png' },
      }),
    );
    expect(repo.createImage).toHaveBeenCalledWith(
      expect.objectContaining({
        storage_key: 'avatars/generated.png',
        size_bytes: png.length,
        width: 1,
        height: 1,
        mime_type: 'image/png',
      }),
    );
    await expect(access(file.path)).rejects.toBeDefined();
  });
  it('cleans up uploaded storage when metadata persistence fails', async () => {
    const file = await fixture();
    const error = new Error('database failed');
    storage.putObject.mockResolvedValue({});
    storage.deleteObject.mockResolvedValue(undefined);
    repo.createImage.mockRejectedValue(error);
    await expect(service().create({ file, folder: 'images' })).rejects.toBe(
      error,
    );
    expect(storage.deleteObject).toHaveBeenCalledWith({
      key: 'images/generated.png',
    });
  });
  it('keeps the old object on update failure and removes the replacement', async () => {
    const file = await fixture();
    const image = { storage_key: 'old/key.png' } as ImageEntity;
    repo.updateImage.mockRejectedValue(new Error('database failed'));
    storage.putObject.mockResolvedValue({});
    storage.deleteObject.mockResolvedValue(undefined);
    await expect(
      service().update({ image, file, folder: 'new' }),
    ).rejects.toThrow('database failed');
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
    expect(storage.deleteObject).toHaveBeenCalledWith({
      key: 'new/generated.png',
    });
  });
  it('does not persist when upload fails but still removes the temporary file', async () => {
    const file = await fixture();
    const error = new Error('upload failed');
    storage.putObject.mockRejectedValue(error);
    await expect(service().create({ file, folder: 'images' })).rejects.toBe(
      error,
    );
    expect(repo.createImage).not.toHaveBeenCalled();
    await expect(access(file.path)).rejects.toBeDefined();
  });
});
