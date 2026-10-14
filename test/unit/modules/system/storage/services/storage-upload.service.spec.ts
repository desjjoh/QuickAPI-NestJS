import { StorageUploadService } from '@/modules/system/storage/services/storage-upload.service';
import { ServiceUnavailableException } from '@nestjs/common';
import { STORAGE_UPLOAD_FAILURE } from '@/modules/system/storage/types/storage-upload.contract';

describe('StorageUploadService', () => {
  const setup = () => {
    const storage = { putObject: jest.fn().mockResolvedValue({}) };
    const objects = {
      reserve: jest.fn().mockResolvedValue({
        storage_key: 'heroes/unique.png',
        filename: 'unique.png',
      }),
      upload: jest.fn(async (_key, work) => work()),
      attach: jest.fn(),
      abandon: jest.fn(),
    };
    return {
      storage,
      objects,
      service: new StorageUploadService(storage as never, objects as never),
    };
  };
  const input = {
    filename: 'unsafe.exe',
    originalName: 'photo.png',
    folder: 'heroes',
    buffer: Buffer.from('image'),
    mimeType: 'image/png',
    extension: '.png',
  };
  it('reserves a unique key before uploading with an abort deadline', async () => {
    const { storage, objects, service } = setup();
    await expect(service.upload(input)).resolves.toEqual({
      storage_key: 'heroes/unique.png',
      filename: 'unique.png',
    });
    expect(objects.reserve).toHaveBeenCalledWith('heroes', '.png');
    expect(storage.putObject).toHaveBeenCalledWith({
      key: 'heroes/unique.png',
      body: input.buffer,
      contentType: 'image/png',
      metadata: { filename: 'unique.png', originalName: 'photo.png' },
      signal: expect.any(AbortSignal),
    });
    expect(objects.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      storage.putObject.mock.invocationCallOrder[0],
    );
  });
  it('abandons ambiguous failed uploads and returns a sanitized retryable failure', async () => {
    const { storage, objects, service } = setup();
    const error = new Error('provider failed after accepting bytes');
    storage.putObject.mockRejectedValue(error);
    const failed = service.upload(input);
    await expect(failed).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(failed).rejects.toThrow(STORAGE_UPLOAD_FAILURE);
    expect(objects.abandon).toHaveBeenCalledWith('heroes/unique.png');
  });
  it('delegates attachment to the ownership service in the caller transaction', async () => {
    const { service, objects } = setup();
    const manager = {};
    await service.attach(manager as never, 'key');
    expect(objects.attach).toHaveBeenCalledWith(manager, 'key');
  });
  it('does not start PUT when reservation persistence fails', async () => {
    const { service, objects, storage } = setup();
    objects.reserve.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.upload(input)).rejects.toThrow('database unavailable');
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(objects.abandon).not.toHaveBeenCalled();
  });
  it('leaves the durable reservation recoverable when marking abandonment fails', async () => {
    const { service, objects } = setup();
    objects.abandon.mockRejectedValue(new Error('database unavailable'));
    await expect(service.abandon('key')).resolves.toBeUndefined();
  });
});
