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

import { CloudflareStorageService } from './cloudflare.r2.service';
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
    const result = await new CloudflareStorageService().putObject({
      key: '/images/a.png',
      body: 'hello',
      contentType: 'image/png',
      metadata: { source: 'test' },
    });
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

  it('maps head success and any client error to existence', async () => {
    const service = new CloudflareStorageService();
    send.mockResolvedValueOnce({});
    await expect(service.objectExists('a')).resolves.toBe(true);
    send.mockRejectedValueOnce(new Error('not found'));
    await expect(service.objectExists('missing')).resolves.toBe(false);
  });
});
