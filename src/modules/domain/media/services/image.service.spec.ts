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
  const manager = {
    create: jest.fn(),
    save: jest.fn(),
    findOneByOrFail: jest.fn(),
    merge: jest.fn(),
    delete: jest.fn(),
  };
  const repo = {
    findById: jest.fn(),
    manager,
  };
  const storage = { putObject: jest.fn(), deleteObject: jest.fn() };
  beforeEach(() => {
    jest.resetAllMocks();
    manager.create.mockImplementation((_entity, value) => ({
      id: '1',
      ...value,
    }));
    manager.merge.mockImplementation((_entity, target, value) =>
      Object.assign(target, value),
    );
    manager.save.mockImplementation(async (_entity, value) => value);
    manager.findOneByOrFail.mockImplementation(async (_entity, options) => ({
      id: options.id,
    }));
    manager.delete.mockResolvedValue({ affected: 1, raw: [] });
  });
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
    expect(repo.findById).toHaveBeenCalledWith(manager, 'missing');
  });
  it('persists extracted metadata after upload and removes the temporary file', async () => {
    const file = await fixture();
    storage.putObject.mockResolvedValue({});
    manager.findOneByOrFail.mockImplementation(async (_entity, options) => ({
      id: options.id,
      storage_key: 'avatars/generated.png',
      filename: 'generated.png',
      size_bytes: png.length,
      width: 1,
      height: 1,
      mime_type: 'image/png',
      alt_text: 'portrait',
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
    expect(manager.create).toHaveBeenCalledWith(
      ImageEntity,
      expect.objectContaining({
        storage_key: 'avatars/generated.png',
        size_bytes: png.length,
        width: 1,
        height: 1,
        mime_type: 'image/png',
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      ImageEntity,
      expect.objectContaining({ storage_key: 'avatars/generated.png' }),
    );
    expect(manager.findOneByOrFail).toHaveBeenCalledWith(ImageEntity, {
      id: '1',
    });
    await expect(access(file.path)).rejects.toBeDefined();
  });
  it('cleans up uploaded storage when metadata persistence fails', async () => {
    const file = await fixture();
    const error = new Error('database failed');
    storage.putObject.mockResolvedValue({});
    storage.deleteObject.mockResolvedValue(undefined);
    manager.save.mockRejectedValue(error);
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
    manager.save.mockRejectedValue(new Error('database failed'));
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
    expect(manager.create).not.toHaveBeenCalled();
    await expect(access(file.path)).rejects.toBeDefined();
  });

  it('updates a detached image without mutating the caller entity', async () => {
    const file = await fixture();
    const image = {
      id: 'image-id',
      storage_key: 'old/key.png',
      filename: 'old.png',
      alt_text: 'old text',
    } as ImageEntity;
    storage.putObject.mockResolvedValue({});
    storage.deleteObject.mockResolvedValue(undefined);

    await service().update({ image, file, folder: 'new' });

    expect(image).toEqual(
      expect.objectContaining({
        storage_key: 'old/key.png',
        filename: 'old.png',
        alt_text: 'old text',
      }),
    );
    expect(manager.merge).toHaveBeenCalledWith(
      ImageEntity,
      expect.any(Object),
      expect.any(Object),
    );
    expect(manager.merge.mock.calls[0][1]).not.toBe(image);
    expect(manager.merge.mock.calls[0][2]).not.toHaveProperty('alt_text');
    expect(storage.deleteObject).toHaveBeenLastCalledWith({
      key: 'old/key.png',
    });
  });

  it('removes storage and database records through the supplied manager', async () => {
    const image = {
      id: 'image-id',
      storage_key: 'images/image.png',
    } as ImageEntity;
    storage.deleteObject.mockResolvedValue(undefined);

    await expect(service().remove(image)).resolves.toBe(image);

    expect(storage.deleteObject).toHaveBeenCalledWith({
      key: image.storage_key,
    });
    expect(manager.delete).toHaveBeenCalledWith(ImageEntity, {
      id: image.id,
    });
  });
});
