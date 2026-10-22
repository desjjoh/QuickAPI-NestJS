import sharp from 'sharp';
import { Test } from '@nestjs/testing';
import { ImageProcessingModule } from '@/modules/system/image-processing/image-processing.module';
import { ImageProcessingService } from '@/modules/system/image-processing/services/image-processing.service';
import { ImageProcessingError } from '@/modules/system/image-processing/types/image-processing.types';

const fixture = (width = 30, height = 20) =>
  sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();

describe('WebP image processing', () => {
  const service = new ImageProcessingService();

  it('exports a standalone injectable service without storage or database dependencies', async () => {
    const module = await Test.createTestingModule({
      imports: [ImageProcessingModule],
    }).compile();
    try {
      expect(module.get(ImageProcessingService)).toBeInstanceOf(
        ImageProcessingService,
      );
    } finally {
      await module.close();
    }
  });

  it.each(['png', 'jpeg', 'gif', 'webp'] as const)(
    'accepts %s and returns accurate WebP storage metadata without changing input',
    async (format) => {
      const input = await sharp(await fixture())
        .toFormat(format)
        .toBuffer();
      const original = Buffer.from(input);
      const result = await service.process(input);
      const metadata = await sharp(result.buffer).metadata();
      expect(input).toEqual(original);
      expect(result.buffer).not.toBe(input);
      expect(result).toMatchObject({
        width: 30,
        height: 20,
        format: 'webp',
        mimeType: 'image/webp',
        extension: '.webp',
        sizeBytes: result.buffer.length,
      });
      expect(metadata).toMatchObject({
        format: 'webp',
        width: result.width,
        height: result.height,
      });
      expect(metadata.pages ?? 1).toBe(1);
    },
  );

  it.each([
    [600, 300],
    [300, 600],
    [300, 300],
    [3, 2],
  ])(
    'forces a %sx%s image into an exact 256px square when enlargement is requested',
    async (width, height) => {
      const result = await service.process(await fixture(width, height), {
        resize: { width: 256, height: 256, allowEnlargement: true },
      });
      expect(await sharp(result.buffer).metadata()).toMatchObject({
        width: 256,
        height: 256,
      });
    },
  );

  it('crops the center rather than stretching or selecting an edge', async () => {
    const data = Buffer.alloc(90 * 30 * 3);
    for (let y = 0; y < 30; y++)
      for (let x = 0; x < 90; x++)
        data[(y * 90 + x) * 3 + Math.floor(x / 30)] = 255;
    const input = await sharp(data, {
      raw: { width: 90, height: 30, channels: 3 },
    })
      .png()
      .toBuffer();
    const center = await service.process(input, {
      resize: { width: 30, height: 30 },
      webp: { lossless: true },
    });
    const left = await service.process(input, {
      resize: { width: 30, height: 30, position: 'west' },
      webp: { lossless: true },
    });
    expect([
      ...(await sharp(center.buffer).raw().toBuffer()).subarray(0, 3),
    ]).toEqual([0, 255, 0]);
    expect([
      ...(await sharp(left.buffer).raw().toBuffer()).subarray(0, 3),
    ]).toEqual([255, 0, 0]);
  });

  it('preserves aspect ratio with width-only resize and avoids enlargement by default', async () => {
    expect(
      await service.process(await fixture(), { resize: { width: 15 } }),
    ).toMatchObject({ width: 15, height: 10 });
    expect(
      await service.process(await fixture(), { resize: { width: 300 } }),
    ).toMatchObject({ width: 30, height: 20 });
    expect(
      await service.process(await fixture(), {
        resize: { width: 10, height: 10, fit: 'inside' },
      }),
    ).toMatchObject({ width: 10, height: 7 });
  });

  it('corrects EXIF orientation before resizing and strips private metadata', async () => {
    const input = await sharp(await fixture(40, 20))
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await service.process(input);
    const metadata = await sharp(result.buffer).metadata();
    expect(result).toMatchObject({ width: 20, height: 40 });
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it('preserves alpha unless an explicit background flatten is requested', async () => {
    const input = await fixture();
    expect(
      (await sharp((await service.process(input)).buffer).metadata()).hasAlpha,
    ).toBe(true);
    expect(
      (
        await sharp(
          (await service.process(input, { flatten: true, background: '#fff' }))
            .buffer,
        ).metadata()
      ).hasAlpha,
    ).toBe(false);
  });

  it('contains with padding and supports proportional outside resizing', async () => {
    const input = await fixture();
    expect(
      await service.process(input, {
        resize: { width: 30, height: 30, fit: 'contain' },
      }),
    ).toMatchObject({ width: 30, height: 30 });
    expect(
      await service.process(input, {
        resize: { width: 15, height: 15, fit: 'outside' },
      }),
    ).toMatchObject({ width: 23, height: 15 });
  });

  it('rejects animation by default and explicitly extracts one frame when requested', async () => {
    const input = await sharp(Buffer.from([255, 0, 0, 0, 0, 255]), {
      raw: { width: 1, height: 2, channels: 3, pageHeight: 1 },
    })
      .gif()
      .toBuffer();
    await expect(service.process(input)).rejects.toMatchObject({
      code: 'unsupported_animation',
    });
    const output = await service.process(input, {
      animation: 'first-frame',
      webp: { lossless: true },
    });
    expect(output).toMatchObject({ width: 1, height: 1 });
    expect((await sharp(output.buffer).metadata()).pages ?? 1).toBe(1);
  });

  it('fails safely on corrupt raster data and remains usable afterwards', async () => {
    await expect(
      service.process(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    ).rejects.toBeInstanceOf(ImageProcessingError);
    await expect(service.process(await fixture())).resolves.toMatchObject({
      format: 'webp',
    });
  });

  it('rejects extreme proportional output sizes before encoding', async () => {
    await expect(
      service.process(await fixture(1, 100), {
        resize: { width: 8192, allowEnlargement: true },
      }),
    ).rejects.toMatchObject({ code: 'limit_exceeded' });
    await expect(
      service.process(await fixture(1, 100), {
        resize: {
          width: 8192,
          height: 10,
          fit: 'outside',
          allowEnlargement: true,
        },
      }),
    ).rejects.toMatchObject({ code: 'limit_exceeded' });
  });
});
