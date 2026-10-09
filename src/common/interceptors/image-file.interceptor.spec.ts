import {
  Body,
  Controller,
  INestApplication,
  Post,
  UploadedFile,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsNotEmpty, IsString } from 'class-validator';
import { mkdir, readdir } from 'node:fs/promises';
import request from 'supertest';
import sharp from 'sharp';
import { uploadTempRoot } from '@/config/storage.config';
import { ImageUploadValidationPipe } from '@/common/pipes/image-upload.pipe';
import { ImageFileInterceptor } from './image-file.interceptor';
import { UpdateArticleHeroDto } from '@/modules/api/v1/creator/articles/models/update-article-hero.model';

class UploadBody {
  @IsString()
  @IsNotEmpty()
  public title!: string;
}

@Controller('upload')
class UploadTestController {
  @Post('accessibility')
  @UseInterceptors(ImageFileInterceptor('image', 4096))
  public accessibility(@Body() body: UpdateArticleHeroDto) {
    return body;
  }

  @Post()
  @UseInterceptors(ImageFileInterceptor('image', 4096))
  public upload(
    @Body() body: UploadBody,
    @UploadedFile(
      new ImageUploadValidationPipe({ maxSize: 4096, fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    return { accepted: Boolean(body.title && file.path) };
  }

  @Post('failure')
  @UseInterceptors(ImageFileInterceptor('image', 4096))
  public failure(@UploadedFile() file: Express.Multer.File) {
    throw new Error(`service failed for ${file.filename}`);
  }
}

describe('multipart image ownership', () => {
  let app: INestApplication;
  let png: Buffer;
  let before: string[];
  beforeAll(async () => {
    await mkdir(uploadTempRoot, { recursive: true });
    const module = await Test.createTestingModule({
      controllers: [UploadTestController],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    png = await sharp({
      create: { width: 1, height: 1, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
  });
  beforeEach(async () => {
    before = (await readdir(uploadTempRoot)).sort();
  });
  afterEach(async () => {
    expect((await readdir(uploadTempRoot)).sort()).toEqual(before);
  });
  afterAll(async () => {
    await app.close();
  });

  it('removes successful uploads before returning the response', async () => {
    await request(app.getHttpServer())
      .post('/upload')
      .field('title', 'Valid')
      .attach('image', png, 'image.png')
      .expect(201);
  });

  it('accepts multipart decorative choices and keeps the flag in the validated body', async () => {
    const response = await request(app.getHttpServer())
      .post('/upload/accessibility')
      .field('expected_version', '1')
      .field('hero_decorative', 'true')
      .attach('image', png, 'image.png')
      .expect(201);
    expect(response.body.hero_decorative).toBe(true);
  });

  it.each([undefined, '', '  '])(
    'rejects unresolved multipart alt text and cleans up: %s',
    async (text) => {
      const pending = request(app.getHttpServer()).post(
        '/upload/accessibility',
      );
      if (text !== undefined) pending.field('hero_alt_text', text);
      await pending.attach('image', png, 'image.png').expect(400);
    },
  );

  it('does not mistake multipart false for a decorative choice', async () => {
    await request(app.getHttpServer())
      .post('/upload/accessibility')
      .field('expected_version', '1')
      .field('hero_decorative', 'false')
      .attach('image', png, 'image.png')
      .expect(400);
  });
  it('cleans up when body validation fails', async () => {
    await request(app.getHttpServer())
      .post('/upload')
      .attach('image', png, 'image.png')
      .expect(400);
  });
  it('cleans up when image validation fails', async () => {
    await request(app.getHttpServer())
      .post('/upload')
      .field('title', 'Valid')
      .attach('image', Buffer.from('corrupt'), 'image.png')
      .expect(400);
  });
  it('cleans up when the handler fails', async () => {
    await request(app.getHttpServer())
      .post('/upload/failure')
      .attach('image', png, 'image.png')
      .expect(500);
  });
  it('enforces the streaming size limit and removes partial files', async () => {
    await request(app.getHttpServer())
      .post('/upload')
      .field('title', 'Valid')
      .attach('image', Buffer.alloc(4097), 'image.png')
      .expect(413);
  });
  it('rejects multiple files and cleans up the first upload', async () => {
    await request(app.getHttpServer())
      .post('/upload')
      .field('title', 'Valid')
      .attach('image', png, 'image.png')
      .attach('image', png, 'second.png')
      .expect(400);
  });
  it('rejects a forged content type and cleans up', async () => {
    await request(app.getHttpServer())
      .post('/upload')
      .field('title', 'Valid')
      .attach('image', png, {
        filename: 'image.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
  });
});
