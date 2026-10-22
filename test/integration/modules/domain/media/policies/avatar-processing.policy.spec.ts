import sharp from 'sharp';
import { avatarProcessingPolicy } from '@/modules/domain/media/policies/avatar-processing.policy';
import { ImageProcessingService } from '@/modules/system/image-processing/services/image-processing.service';

describe('avatar processing policy', () => {
  const processor = new ImageProcessingService();

  it.each([
    [600, 300],
    [300, 600],
    [300, 300],
    [16, 8],
  ])('converts %sx%s input to an exact WebP avatar', async (width, height) => {
    const input = await sharp({
      create: { width, height, channels: 3, background: '#ff0000' },
    })
      .png()
      .toBuffer();

    const result = await processor.process(input, avatarProcessingPolicy);
    const metadata = await sharp(result.buffer).metadata();

    expect(result).toMatchObject({
      width: 256,
      height: 256,
      format: 'webp',
      mimeType: 'image/webp',
      extension: '.webp',
      sizeBytes: result.buffer.length,
    });
    expect(metadata).toMatchObject({ width: 256, height: 256, format: 'webp' });
    expect(metadata.pages ?? 1).toBe(1);
  });

  it.each(['landscape', 'portrait'] as const)(
    'center-crops %s input instead of stretching the full image',
    async (shape) => {
      const width = shape === 'landscape' ? 768 : 256;
      const height = shape === 'portrait' ? 768 : 256;
      const pixels = Buffer.alloc(width * height * 3);

      // Three equal red/green/blue bands: only the green center should remain.
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const band = Math.floor((shape === 'landscape' ? x : y) / 256);
          pixels[(y * width + x) * 3 + band] = 255;
        }
      }

      const input = await sharp(pixels, {
        raw: { width, height, channels: 3 },
      })
        .png()
        .toBuffer();

      const result = await processor.process(input, avatarProcessingPolicy);
      const { channels } = await sharp(result.buffer).stats();

      expect(channels[0].max).toBeLessThan(10);
      expect(channels[1].min).toBeGreaterThan(245);
      expect(channels[2].max).toBeLessThan(10);
    },
  );

  it('corrects EXIF orientation and removes orientation metadata', async () => {
    const width = 256;
    const pixels = Buffer.alloc(width * width * 3);

    // A clockwise EXIF rotation turns left-red/right-blue into top-red/bottom-blue.
    for (let y = 0; y < width; y++) {
      for (let x = 0; x < width; x++) {
        pixels[(y * width + x) * 3 + (x < width / 2 ? 0 : 2)] = 255;
      }
    }

    const input = await sharp(pixels, {
      raw: { width, height: width, channels: 3 },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await processor.process(input, avatarProcessingPolicy);
    const metadata = await sharp(result.buffer).metadata();
    const output = await sharp(result.buffer).removeAlpha().raw().toBuffer();
    const top = (64 * width + 128) * 3;
    const bottom = (192 * width + 128) * 3;

    expect(output[top]).toBeGreaterThan(240);
    expect(output[top + 2]).toBeLessThan(15);
    expect(output[bottom]).toBeLessThan(15);
    expect(output[bottom + 2]).toBeGreaterThan(240);
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
  });

  it('preserves transparency without flattening onto a background', async () => {
    const input = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();

    const result = await processor.process(input, avatarProcessingPolicy);
    const metadata = await sharp(result.buffer).metadata();
    const { channels } = await sharp(result.buffer).stats();

    expect(metadata.hasAlpha).toBe(true);
    expect(channels[3].min).toBeGreaterThanOrEqual(127);
    expect(channels[3].max).toBeLessThanOrEqual(128);
  });

  it('extracts the first GIF frame into a static 256px avatar', async () => {
    const input = await sharp(Buffer.from([255, 0, 0, 0, 0, 255]), {
      raw: { width: 1, height: 2, channels: 3, pageHeight: 1 },
    })
      .gif()
      .toBuffer();

    expect((await sharp(input, { animated: true }).metadata()).pages).toBe(2);

    const result = await processor.process(input, avatarProcessingPolicy);
    const metadata = await sharp(result.buffer).metadata();
    const { channels } = await sharp(result.buffer).stats();

    expect(metadata).toMatchObject({ width: 256, height: 256, format: 'webp' });
    expect(metadata.pages ?? 1).toBe(1);
    expect(channels[0].min).toBeGreaterThan(240);
    expect(channels[1].max).toBeLessThan(15);
    expect(channels[2].max).toBeLessThan(15);
  });
});
