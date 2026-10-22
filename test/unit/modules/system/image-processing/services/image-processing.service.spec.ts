jest.mock('sharp', () => jest.fn());

import sharp from 'sharp';
import { ImageProcessingService } from '@/modules/system/image-processing/services/image-processing.service';
import { imageProcessingPolicy } from '@/config/image-processing.config';
import type { ImageProcessingOptions } from '@/modules/system/image-processing/types/image-processing.types';

const input = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const output = { data: Buffer.from('encoded'), info: { width: 2, height: 2 } };
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('image processor policies and capacity', () => {
  let service: ImageProcessingService;
  const pipeline = {
    timeout: jest.fn().mockReturnThis(),
    metadata: jest.fn(),
    autoOrient: jest.fn().mockReturnThis(),
    toColourspace: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    flatten: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn(),
  };
  beforeEach(() => {
    jest.clearAllMocks();
    pipeline.metadata.mockResolvedValue({ width: 2, height: 2 });
    pipeline.toBuffer.mockReset().mockResolvedValue(output);
    jest.mocked(sharp).mockReturnValue(pipeline as never);
    service = new ImageProcessingService();
  });

  it('uses bounded decoder settings, strips metadata by omission, and defaults to WebP', async () => {
    const result = await service.process(input);
    expect(sharp).toHaveBeenCalledWith(input, {
      animated: false,
      failOn: 'warning',
      limitInputPixels: imageProcessingPolicy.maxInputPixels,
    });
    expect(jest.mocked(sharp).mock.calls[0][0]).not.toBe(input);
    expect(pipeline.timeout).toHaveBeenCalledWith({
      seconds: imageProcessingPolicy.timeoutSeconds,
    });
    expect(pipeline.autoOrient).toHaveBeenCalled();
    expect(pipeline.toColourspace).toHaveBeenCalledWith('srgb');
    expect(pipeline.webp).toHaveBeenCalledWith({
      quality: 80,
      alphaQuality: 100,
      effort: 4,
      lossless: false,
    });
    expect(result.sizeBytes).toBe(output.data.length);
  });

  it.each([
    null,
    { resize: {} },
    { resize: null },
    { resize: { width: 0 } },
    { resize: { height: -1 } },
    { resize: { width: 1.2 } },
    { resize: { width: 8193 } },
    { resize: { width: 8192, height: 8192 } },
    { resize: { width: 1, fit: 'stretch' } },
    { resize: { width: 1, position: 'unknown' } },
    { resize: { width: 1, allowEnlargement: 'yes' } },
    { webp: { quality: 0 } },
    { webp: { quality: 101 } },
    { webp: { alphaQuality: 1.5 } },
    { webp: { effort: 7 } },
    { webp: { lossless: 'yes' } },
    { webp: null },
    { background: 'url(secret)' },
    { flatten: 1 },
    { animation: 'preserve' },
  ])('rejects invalid options before decoding: %j', async (options) => {
    await expect(
      service.process(input, options as unknown as ImageProcessingOptions),
    ).rejects.toMatchObject({ code: 'invalid_options' });
    expect(sharp).not.toHaveBeenCalled();
  });

  it.each([Buffer.alloc(0), Buffer.from('<svg/>'), 'not-a-buffer'])(
    'rejects empty, vector, and non-buffer input',
    async (value) => {
      await expect(service.process(value as Buffer)).rejects.toMatchObject({
        code: 'invalid_input',
      });
      expect(sharp).not.toHaveBeenCalled();
    },
  );

  it('rejects excessive input bytes and oversized/frame-heavy images before encoding', async () => {
    await expect(
      service.process(Buffer.alloc(imageProcessingPolicy.maxInputBytes + 1)),
    ).rejects.toMatchObject({ code: 'limit_exceeded' });
    expect(sharp).not.toHaveBeenCalled();
    pipeline.metadata.mockResolvedValue({ width: 8193, height: 1 });
    await expect(service.process(input)).rejects.toMatchObject({
      code: 'limit_exceeded',
    });
    pipeline.metadata.mockResolvedValue({
      width: 8000,
      height: 8000,
      pages: 2,
    });
    await expect(service.process(input)).rejects.toMatchObject({
      code: 'limit_exceeded',
    });
    expect(pipeline.toBuffer).not.toHaveBeenCalled();
  });

  it('rejects APNG explicitly even when first-frame extraction is requested', async () => {
    // Animation-control chunk; pixel/CRC validation remains the decoder's job.
    const chunk = Buffer.alloc(20);
    chunk.writeUInt32BE(8);
    chunk.write('acTL', 4, 'ascii');
    const apng = Buffer.concat([input, chunk]);
    await expect(service.process(apng)).rejects.toMatchObject({
      code: 'unsupported_animation',
    });
    await expect(
      service.process(apng, { animation: 'first-frame' }),
    ).rejects.toMatchObject({ code: 'unsupported_animation' });
    expect(sharp).not.toHaveBeenCalled();
  });

  it('bounds queued jobs, hands capacity to waiting jobs, and copies input before waiting', async () => {
    const pending: Array<(value: typeof output) => void> = [];
    pipeline.toBuffer.mockImplementation(
      () => new Promise((resolve) => pending.push(resolve)),
    );
    const count =
      imageProcessingPolicy.maxConcurrent + imageProcessingPolicy.maxQueued;
    const mutable = Buffer.from(input);
    const jobs = Array.from({ length: count }, () => service.process(mutable));
    mutable.fill(0);
    await tick();
    expect(sharp).toHaveBeenCalledTimes(imageProcessingPolicy.maxConcurrent);
    await expect(service.process(input)).rejects.toMatchObject({
      code: 'busy',
    });
    for (let index = 0; index < count; index++) {
      pending.shift()!(output);
      await tick();
    }
    await Promise.all(jobs);
    expect(sharp).toHaveBeenCalledTimes(count);
    for (const call of jest.mocked(sharp).mock.calls)
      expect(call[0]).toEqual(input);
    pipeline.toBuffer.mockResolvedValue(output);
    await expect(service.process(input)).resolves.toMatchObject({
      format: 'webp',
    });
  });

  it('sanitizes decoder errors and releases failed processing capacity', async () => {
    pipeline.metadata.mockRejectedValueOnce(
      new Error('sensitive decoder details'),
    );
    await expect(service.process(input)).rejects.toMatchObject({
      code: 'processing_failed',
      message: 'Image decoding or processing failed.',
    });
    await expect(service.process(input)).resolves.toMatchObject({
      format: 'webp',
    });
  });

  it('rejects oversized encoded outputs instead of returning inconsistent storage metadata', async () => {
    pipeline.toBuffer.mockResolvedValue({
      ...output,
      info: { width: 9000, height: 2 },
    });
    await expect(service.process(input)).rejects.toMatchObject({
      code: 'limit_exceeded',
    });
    pipeline.toBuffer.mockResolvedValue({
      ...output,
      data: Buffer.alloc(imageProcessingPolicy.maxOutputBytes + 1),
    });
    await expect(service.process(input)).rejects.toMatchObject({
      code: 'limit_exceeded',
    });
  });

  it('sanitizes encoder and timeout failures and remains usable', async () => {
    for (const message of ['sensitive encoder details', 'timeout exceeded']) {
      pipeline.toBuffer.mockRejectedValueOnce(new Error(message));

      await expect(service.process(input)).rejects.toMatchObject({
        code: 'processing_failed',
        message: 'Image decoding or processing failed.',
      });
    }

    await expect(service.process(input)).resolves.toMatchObject({
      format: 'webp',
    });
  });
});
