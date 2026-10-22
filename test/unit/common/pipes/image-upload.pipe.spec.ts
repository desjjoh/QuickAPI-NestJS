import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { ImageUploadValidationPipe } from '@/common/pipes/image-upload.pipe';
import { ImageProcessingService } from '@/modules/system/image-processing/services/image-processing.service';
import { avatarProcessingPolicy } from '@/modules/domain/media/policies/avatar-processing.policy';

const upload = (buffer: Buffer) =>
  ({
    buffer,
    mimetype: 'image/png',
    size: buffer.length,
  }) as Express.Multer.File;

describe('ImageUploadValidationPipe', () => {
  const pipe = new ImageUploadValidationPipe({ fileIsRequired: true });

  it('fully decodes valid images before accepting them', async () => {
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    const file = upload(buffer);
    const stats = jest.spyOn(sharp.prototype, 'stats');

    try {
      await expect(pipe.transform(file)).resolves.toBe(file);
      expect(stats).toHaveBeenCalledTimes(1);
    } finally {
      stats.mockRestore();
    }
  });

  it('rejects damaged pixels even with a valid signature and readable dimensions', async () => {
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    buffer[buffer.indexOf(Buffer.from('IDAT')) + 4] ^= 255;

    expect(await sharp(buffer).metadata()).toMatchObject({
      width: 2,
      height: 2,
    });
    await expect(pipe.transform(upload(buffer))).rejects.toThrow('corrupt');
  });

  it('rejects missing required files', async () => {
    await expect(pipe.transform(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('defers corruption validation to processing without a separate full decode', async () => {
    const processingPipe = new ImageUploadValidationPipe({
      fileIsRequired: true,
      processing: true,
    });
    const file = upload(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const stats = jest.spyOn(sharp.prototype, 'stats');

    try {
      await expect(processingPipe.transform(file)).resolves.toBe(file);
      expect(stats).not.toHaveBeenCalled();
      await expect(
        new ImageProcessingService().process(
          file.buffer,
          avatarProcessingPolicy,
        ),
      ).rejects.toMatchObject({ code: 'processing_failed' });
    } finally {
      stats.mockRestore();
    }
  });

  it('still rejects MIME mismatches when pixel validation is deferred', async () => {
    const processingPipe = new ImageUploadValidationPipe({ processing: true });
    const file = upload(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    file.mimetype = 'image/jpeg';

    await expect(processingPipe.transform(file)).rejects.toThrow(
      'does not match',
    );
  });
});
