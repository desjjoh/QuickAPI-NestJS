import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { readValidatedImage } from './image-upload.policy';

const upload = (buffer: Buffer, mimetype = 'image/png') =>
  ({ buffer, mimetype, size: buffer.length }) as Express.Multer.File;

describe('image upload policy', () => {
  it.each([
    ['png', 'image/png', '.png'],
    ['jpeg', 'image/jpeg', '.jpg'],
    ['gif', 'image/gif', '.gif'],
  ] as const)(
    'decodes %s and derives its storage metadata',
    async (format, mimeType, extension) => {
      const buffer = await sharp({
        create: { width: 3, height: 2, channels: 3, background: 'red' },
      })
        .toFormat(format)
        .toBuffer();
      const result = await readValidatedImage(upload(buffer, mimeType));
      expect(result).toMatchObject({
        width: 3,
        height: 2,
        mimeType,
        extension,
      });
      expect(result.buffer).toEqual(buffer);
    },
  );

  it('accepts the legacy image/jpg MIME alias and stores canonical image/jpeg', async () => {
    const buffer = await sharp({
      create: { width: 1, height: 1, channels: 3, background: 'red' },
    })
      .jpeg()
      .toBuffer();
    expect(await readValidatedImage(upload(buffer, 'image/jpg'))).toMatchObject(
      { mimeType: 'image/jpeg', extension: '.jpg' },
    );
  });

  it('rejects a MIME mismatch before persistence', async () => {
    const buffer = await sharp({
      create: { width: 1, height: 1, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await expect(
      readValidatedImage(upload(buffer, 'image/jpeg')),
    ).rejects.toThrow('does not match');
  });

  it('validates all frames of an animated GIF while returning single-frame dimensions', async () => {
    const buffer = await sharp(Buffer.from([255, 0, 0, 0, 0, 255]), {
      raw: { width: 1, height: 2, channels: 3, pageHeight: 1 },
    })
      .gif()
      .toBuffer();
    expect((await sharp(buffer, { animated: true }).metadata()).pages).toBe(2);
    expect(await readValidatedImage(upload(buffer, 'image/gif'))).toMatchObject(
      { width: 1, height: 1, mimeType: 'image/gif' },
    );
  });

  it.each([
    Buffer.from('not an image'),
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
  ])('rejects unsupported contents', async (buffer) => {
    await expect(readValidatedImage(upload(buffer))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects damaged pixel data even when dimensions can be read', async () => {
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    const corrupt = Buffer.from(buffer);
    const data = corrupt.indexOf(Buffer.from('IDAT'));
    corrupt[data + 4] ^= 255;
    await expect(readValidatedImage(upload(corrupt))).rejects.toThrow(
      'corrupt',
    );
  });

  it('rejects truncated files', async () => {
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: 'red' },
    })
      .jpeg()
      .toBuffer();
    await expect(
      readValidatedImage(upload(buffer.subarray(0, 50), 'image/jpeg')),
    ).rejects.toThrow('corrupt');
  });

  it('enforces actual bytes even when the client file metadata lies', async () => {
    const file = upload(Buffer.alloc(11));
    file.size = 1;
    await expect(readValidatedImage(file, 10)).rejects.toThrow(
      'no larger than',
    );
  });

  it('rejects excessive width', async () => {
    const buffer = await sharp({
      create: { width: 8193, height: 1, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await expect(readValidatedImage(upload(buffer))).rejects.toThrow(
      'dimensions',
    );
  });

  it('rejects excessive total pixels', async () => {
    const buffer = await sharp({
      create: { width: 6500, height: 6500, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await expect(readValidatedImage(upload(buffer))).rejects.toThrow(/pixel/);
  });
});
