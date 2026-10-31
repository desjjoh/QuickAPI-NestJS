import { mkdtemp, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ImageRepository } from '@/modules/domain/media/repositories/image.repository';
import { StorageService } from '@/modules/system/storage/types/storage.types';
import { ImageEntity } from '@/modules/domain/media/entities/image.entity';
import { ImageService } from '@/modules/domain/media/services/image.service';
import { TransactionLifecycle } from '@/common/helpers/transaction.helper';
import { InvalidOperationError } from '@/common/errors/operation.error';
import { StorageCleanupService } from '@/modules/system/storage-cleanup/services/storage-cleanup.service';
import { StorageUploadService } from '@/modules/system/storage/services/storage-upload.service';
import sharp from 'sharp';
import { ImageProcessingService } from '@/modules/system/image-processing/services/image-processing.service';
import { avatarProcessingPolicy } from '@/modules/domain/media/policies/avatar-processing.policy';
import { ImageProcessingError } from '@/modules/system/image-processing/types/image-processing.types';

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
    transaction: jest.fn(),
  };
  const repo = {
    findById: jest.fn(),
    manager,
  };
  const storage = { putObject: jest.fn(), deleteObject: jest.fn() };
  const cleanup = { schedule: jest.fn() };
  const objects = {
    reserve: jest.fn(),
    upload: jest.fn(),
    attach: jest.fn(),
    abandon: jest.fn(),
  };
  beforeEach(() => {
    jest.resetAllMocks();
    storage.putObject.mockResolvedValue({});
    objects.reserve.mockImplementation(async (folder, extension) => ({
      storage_key: `${folder}/generated${extension}`,
      filename: `generated${extension}`,
    }));
    objects.upload.mockImplementation(async (_key, work) => work());
    objects.attach.mockResolvedValue(undefined);
    objects.abandon.mockResolvedValue(undefined);
    manager.transaction.mockImplementation((work) => work(manager));
    cleanup.schedule.mockResolvedValue('intent-id');
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
      new StorageUploadService(
        storage as unknown as StorageService,
        objects as never,
      ),
      cleanup as unknown as StorageCleanupService,
      new ImageProcessingService(),
    );

  it('throws for a missing reference record', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service().findById('missing')).rejects.toThrow(
      'Image with ID "missing" was not found.',
    );
    expect(repo.findById).toHaveBeenCalledWith(manager, 'missing');
  });

  it('stores only processed WebP bytes and persists their actual metadata', async () => {
    const file = await fixture();
    const stats = jest.spyOn(sharp.prototype, 'stats');

    try {
      await service().create({
        file,
        folder: 'avatars',
        processing: avatarProcessingPolicy,
      });

      const uploaded = storage.putObject.mock.calls[0][0];
      const metadata = await sharp(uploaded.body).metadata();

      expect(uploaded.key).toBe('avatars/generated.webp');
      expect(uploaded.contentType).toBe('image/webp');
      expect(uploaded.body).not.toEqual(png);
      expect(metadata).toMatchObject({
        format: 'webp',
        width: 256,
        height: 256,
      });
      expect(manager.create).toHaveBeenCalledWith(
        ImageEntity,
        expect.objectContaining({
          filename: 'generated.webp',
          width: 256,
          height: 256,
          size_bytes: uploaded.body.length,
          mime_type: 'image/webp',
        }),
      );
      expect(stats).not.toHaveBeenCalled();
      await expect(access(file.path)).rejects.toBeDefined();
    } finally {
      stats.mockRestore();
    }
  });

  it('keeps the previous image unchanged and cleans the temporary file on processing failure', async () => {
    const file = await fixture();
    const previous = {
      id: 'old',
      storage_key: 'avatars/old.png',
    } as ImageEntity;
    const process = jest
      .spyOn(ImageProcessingService.prototype, 'process')
      .mockRejectedValue(
        new ImageProcessingError('processing_failed', 'Invalid image.'),
      );

    try {
      await expect(
        service().update({
          file,
          folder: 'avatars',
          image: previous,
          processing: avatarProcessingPolicy,
        }),
      ).rejects.toThrow('Invalid image.');

      expect(previous.storage_key).toBe('avatars/old.png');
      expect(storage.putObject).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
      expect(cleanup.schedule).not.toHaveBeenCalled();
      await expect(access(file.path)).rejects.toBeDefined();
    } finally {
      process.mockRestore();
    }
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
    expect(objects.abandon).toHaveBeenCalledWith('images/generated.png');
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it.each(['create', 'replace'] as const)(
    'abandons a processed WebP when %s metadata cannot be saved',
    async (action) => {
      const file = await fixture();
      const previous = {
        id: 'old',
        storage_key: 'avatars/old.png',
      } as ImageEntity;
      manager.save.mockRejectedValueOnce(new Error('database unavailable'));
      const input = {
        file,
        folder: 'avatars',
        processing: avatarProcessingPolicy,
      };

      await expect(
        action === 'create'
          ? service().create(input)
          : service().update({ ...input, image: previous }),
      ).rejects.toThrow('database unavailable');

      expect(storage.putObject).toHaveBeenCalledTimes(1);
      expect(storage.putObject.mock.calls[0][0].contentType).toBe('image/webp');
      expect(objects.abandon).toHaveBeenCalledWith('avatars/generated.webp');
      expect(previous.storage_key).toBe('avatars/old.png');
      expect(cleanup.schedule).not.toHaveBeenCalled();
      expect(storage.deleteObject).not.toHaveBeenCalled();
      await expect(access(file.path)).rejects.toBeDefined();
    },
  );

  it('abandons the processed object when attachment fails before image persistence', async () => {
    const file = await fixture();
    objects.attach.mockRejectedValueOnce(new Error('attachment failed'));

    await expect(
      service().create({
        file,
        folder: 'avatars',
        processing: avatarProcessingPolicy,
      }),
    ).rejects.toThrow('attachment failed');

    expect(objects.abandon).toHaveBeenCalledWith('avatars/generated.webp');
    expect(manager.save).not.toHaveBeenCalled();
    await expect(access(file.path)).rejects.toBeDefined();
  });

  it('removes malformed uploads even for direct domain calls', async () => {
    const file = await fixture();
    await writeFile(file.path, 'not an image');
    await expect(service().create({ file, folder: 'images' })).rejects.toThrow(
      'Only PNG',
    );
    expect(storage.putObject).not.toHaveBeenCalled();
    await expect(access(file.path)).rejects.toBeDefined();
  });

  it('uses detected type and actual bytes instead of supplied filename extension and size', async () => {
    const file = await fixture();
    file.filename = 'generated.exe';
    file.size = 1;
    storage.putObject.mockResolvedValue({});
    await service().create({ file, folder: 'images' });
    expect(storage.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'images/generated.png',
        contentType: 'image/png',
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      ImageEntity,
      expect.objectContaining({
        filename: 'generated.png',
        mime_type: 'image/png',
        size_bytes: png.length,
      }),
    );
  });
  it('removes a newly created object when the surrounding transaction rolls back', async () => {
    const file = await fixture();
    const lifecycle = new TransactionLifecycle();
    storage.putObject.mockResolvedValue({});
    storage.deleteObject.mockResolvedValue(undefined);

    await service().create(
      { file, folder: 'images' },
      manager as never,
      lifecycle,
    );

    expect(storage.deleteObject).not.toHaveBeenCalled();
    await lifecycle.rollback();
    expect(objects.abandon).toHaveBeenCalledWith('images/generated.png');
    expect(storage.deleteObject).not.toHaveBeenCalled();
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
    expect(objects.abandon).toHaveBeenCalledWith('new/generated.png');
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });
  it('does not persist when upload fails but still removes the temporary file', async () => {
    const file = await fixture();
    const error = new Error('upload failed');
    storage.putObject.mockRejectedValue(error);
    await expect(service().create({ file, folder: 'images' })).rejects.toThrow(
      'Storage upload failed. Please retry.',
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
    expect(cleanup.schedule).toHaveBeenCalledWith(
      manager,
      'old/key.png',
      'image_replaced',
    );
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('persists decorative metadata and clears descriptive text on a detached replacement', async () => {
    const image = {
      id: 'image-1',
      storage_key: 'old.png',
      alt_text: 'Old description',
      decorative: false,
    } as ImageEntity;
    const file = await fixture();
    const updated = await service().update({
      image,
      file,
      folder: 'images',
      alt_text: null,
      decorative: true,
    });
    expect(updated).toEqual(
      expect.objectContaining({ alt_text: null, decorative: true }),
    );
    expect(image.alt_text).toBe('Old description');
    expect(image.decorative).toBe(false);
  });

  it('stores explicit decorative metadata on creation', async () => {
    const file = await fixture();
    await service().create({
      file,
      folder: 'images',
      alt_text: null,
      decorative: true,
    });
    expect(manager.create).toHaveBeenCalledWith(
      ImageEntity,
      expect.objectContaining({ alt_text: null, decorative: true }),
    );
  });

  it('persists a deletion intent alongside replacement without deleting in the request', async () => {
    const file = await fixture();
    const lifecycle = new TransactionLifecycle();
    const image = {
      id: 'image-id',
      storage_key: 'old/key.png',
    } as ImageEntity;
    storage.putObject.mockResolvedValue({});
    storage.deleteObject.mockResolvedValue(undefined);

    await service().update(
      { image, file, folder: 'new' },
      manager as never,
      lifecycle,
    );

    expect(storage.deleteObject).not.toHaveBeenCalled();
    await lifecycle.commit();
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(cleanup.schedule).toHaveBeenCalledWith(
      manager,
      'old/key.png',
      'image_replaced',
    );
  });

  it('compensates the replacement if deletion-intent persistence fails', async () => {
    const file = await fixture();
    cleanup.schedule.mockRejectedValueOnce(new Error('intent insert failed'));
    await expect(
      service().update({
        image: { id: 'old', storage_key: 'old/key.png' } as ImageEntity,
        file,
        folder: 'new',
      }),
    ).rejects.toThrow('intent insert failed');
    expect(objects.abandon).toHaveBeenCalledWith('new/generated.png');
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('preserves the previous object and removes its replacement on rollback', async () => {
    const file = await fixture();
    const lifecycle = new TransactionLifecycle();
    const image = {
      id: 'image-id',
      storage_key: 'old/key.png',
    } as ImageEntity;
    storage.putObject.mockResolvedValue({});
    storage.deleteObject.mockResolvedValue(undefined);

    await service().update(
      { image, file, folder: 'new' },
      manager as never,
      lifecycle,
    );
    await lifecycle.rollback();

    expect(objects.abandon).toHaveBeenCalledWith('new/generated.png');
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalledWith({
      key: 'old/key.png',
    });
  });

  it('removes the database record and records cleanup atomically', async () => {
    const image = {
      id: 'image-id',
      storage_key: 'images/image.png',
    } as ImageEntity;
    storage.deleteObject.mockResolvedValue(undefined);

    await expect(service().remove(image)).resolves.toBe(image);

    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(cleanup.schedule).toHaveBeenCalledWith(
      manager,
      image.storage_key,
      'image_removed',
    );
    expect(manager.delete).toHaveBeenCalledWith(ImageEntity, {
      id: image.id,
    });
  });

  it('defers storage removal until the database transaction commits', async () => {
    const lifecycle = new TransactionLifecycle();
    const image = {
      id: 'image-id',
      storage_key: 'images/image.png',
    } as ImageEntity;
    storage.deleteObject.mockResolvedValue(undefined);

    await service().remove(image, manager as never, lifecycle);

    expect(manager.delete).toHaveBeenCalledWith(ImageEntity, { id: image.id });
    expect(storage.deleteObject).not.toHaveBeenCalled();
    await lifecycle.commit();
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(cleanup.schedule).toHaveBeenCalledWith(
      manager,
      image.storage_key,
      'image_removed',
    );
  });

  it('requires lifecycle coordination for mutations in an active transaction', async () => {
    const transactionalManager = {
      ...manager,
      queryRunner: { isTransactionActive: true },
    };
    const image = {
      id: 'image-id',
      storage_key: 'images/image.png',
    } as ImageEntity;

    await expect(
      service().remove(image, transactionalManager as never),
    ).rejects.toBeInstanceOf(InvalidOperationError);
    expect(manager.delete).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });
});
