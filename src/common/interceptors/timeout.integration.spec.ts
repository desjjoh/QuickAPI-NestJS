import {
  Controller,
  Get,
  INestApplication,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { EntityManager } from 'typeorm';
import request from 'supertest';
import { existsSync } from 'node:fs';
import { TimeoutInterceptor } from './timeout.interceptor';
import { ImageFileInterceptor } from './image-file.interceptor';
import { GlobalExceptionFilter } from '../filters/global.filter';
import { runInTransaction } from '../helpers/transaction.helper';
import { RequestTimeout } from '../decorators/request-timeout.decorator';

describe('HTTP timeout transaction and upload lifecycle', () => {
  let app: INestApplication;
  let release: () => void;
  let drained: Promise<void>;
  let events: string[];
  let uploadPath: string | undefined;
  let storageObjects: Set<string>;
  let manager: EntityManager;

  @Controller()
  class Routes {
    @Get('health')
    public health() {
      return { alive: true };
    }

    @Get('slow')
    public async slow() {
      return this.mutate();
    }

    @Post('upload')
    @UseInterceptors(ImageFileInterceptor('hero', 1024))
    public async upload(@UploadedFile() file: Express.Multer.File) {
      uploadPath = file.path;
      return this.mutate();
    }

    @Get('upload-deadline')
    @RequestTimeout(1000)
    public async uploadDeadline() {
      await new Promise((resolve) => setTimeout(resolve, 120));
      return { uploaded: true };
    }

    private async mutate() {
      try {
        return await runInTransaction(manager, async (_tx, lifecycle) => {
          storageObjects.add('new-upload');
          lifecycle.afterRollback(() => {
            storageObjects.delete('new-upload');
            events.push('cleanup');
          });
          events.push('started');
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          events.push('work-settled');
          return { saved: true };
        });
      } finally {
        // ImageFileInterceptor still owns its file until its stream settles.
        if (uploadPath)
          events.push(
            existsSync(uploadPath) ? 'file-retained' : 'file-missing',
          );
      }
    }
  }

  beforeEach(async () => {
    events = [];
    uploadPath = undefined;
    storageObjects = new Set();
    let resolveDrain!: () => void;
    drained = new Promise<void>((resolve) => {
      resolveDrain = resolve;
    });
    manager = {
      transaction: async <T>(work: (manager: EntityManager) => Promise<T>) => {
        try {
          const result = await work({} as EntityManager);
          events.push('committed');
          return result;
        } catch (error) {
          events.push('rolled-back');
          throw error;
        } finally {
          events.push('released');
          // Observe completion after rollback hooks and interceptor cleanup.
          setImmediate(() => setImmediate(resolveDrain));
        }
      },
    } as EntityManager;
    const module = await Test.createTestingModule({
      controllers: [Routes],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalInterceptors(new TimeoutInterceptor(75));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });
  afterEach(async () => {
    release?.();
    await app.close();
  });

  it.each(['slow', 'upload'])(
    'returns 408 and retains resources until %s work settles',
    async (route) => {
      const call =
        route === 'upload'
          ? request(app.getHttpServer())
              .post('/upload')
              .attach('hero', Buffer.from('fixture'), 'hero.png')
          : request(app.getHttpServer()).get('/slow');
      await call.expect(408);
      expect(events).toEqual(['started']);
      expect(storageObjects.size).toBe(1);
      if (uploadPath) expect(existsSync(uploadPath)).toBe(true);
      await request(app.getHttpServer())
        .get('/health')
        .expect(200, { alive: true });
      release();
      await drained;
      expect(events.slice(0, 5)).toEqual([
        'started',
        'work-settled',
        'rolled-back',
        'released',
        'cleanup',
      ]);
      expect(events).not.toContain('committed');
      expect(storageObjects.size).toBe(0);
      if (uploadPath) {
        expect(events).toContain('file-retained');
        // Rollback completion precedes the interceptor's asynchronous unlink.
        for (
          let attempt = 0;
          existsSync(uploadPath) && attempt < 100;
          attempt++
        )
          await new Promise((resolve) => setTimeout(resolve, 10));
        expect(existsSync(uploadPath)).toBe(false);
      }
    },
  );

  it('allows upload-specific work beyond the ordinary deadline', async () => {
    await request(app.getHttpServer())
      .get('/upload-deadline')
      .expect(200, { uploaded: true });
  });
});
