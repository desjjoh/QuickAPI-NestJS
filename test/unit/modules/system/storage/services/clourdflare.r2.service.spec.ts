const send = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  class Command {
    constructor(public readonly input: unknown) {}
  }
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send })),
    PutObjectCommand: class extends Command {},
    DeleteObjectCommand: class extends Command {},
    HeadObjectCommand: class extends Command {},
  };
});

import { CloudflareStorageService } from '@/modules/system/storage/services/cloudflare.r2.service';
import { env } from '@/config/environment.config';

describe('CloudflareStorageService', () => {
  beforeEach(() => {
    send.mockReset();
    Object.assign(env, {
      R2_BUCKET_NAME: 'bucket',
      R2_PUBLIC_BASE_URL: 'https://cdn.example.com/',
    });
  });

  it('uploads mapped content and returns normalized metadata', async () => {
    send.mockResolvedValue({});
    const signal = AbortSignal.timeout(60000);
    const result = await new CloudflareStorageService().putObject({
      key: '/images/a.png',
      body: 'hello',
      contentType: 'image/png',
      metadata: { source: 'test' },
      signal,
    });
    expect(send.mock.calls[0][1]).toEqual({ abortSignal: signal });
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: 'bucket',
      Key: '/images/a.png',
      Body: 'hello',
      ContentType: 'image/png',
      Metadata: { source: 'test' },
    });
    expect(result).toEqual({
      key: '/images/a.png',
      url: 'https://cdn.example.com/images/a.png',
      contentType: 'image/png',
      sizeBytes: 5,
    });
  });

  it.each(['putObject', 'deleteObject'] as const)(
    'propagates %s client failures',
    async (operation) => {
      const error = new Error('R2 unavailable');
      send.mockRejectedValue(error);
      const service = new CloudflareStorageService();
      const promise =
        operation === 'putObject'
          ? service.putObject({
              key: 'a',
              body: Buffer.from('a'),
              contentType: 'text/plain',
            })
          : service.deleteObject({ key: 'a' });
      await expect(promise).rejects.toBe(error);
    },
  );

  it('maps head success and explicit not-found responses to existence', async () => {
    const service = new CloudflareStorageService();
    send.mockResolvedValueOnce({});
    await expect(service.objectExists('a')).resolves.toBe(true);
    send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });
    await expect(service.objectExists('missing')).resolves.toBe(false);
  });

  it.each([401, 403, 500, undefined])(
    'does not mistake HEAD failure %s for a missing object',
    async (status) => {
      const error = Object.assign(new Error('provider unavailable'), {
        $metadata: { httpStatusCode: status },
      });
      send.mockRejectedValueOnce(error);
      await expect(
        new CloudflareStorageService().objectExists('a'),
      ).rejects.toBe(error);
    },
  );
});
