import {
  Controller,
  ExecutionContext,
  INestApplication,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { RefreshTokenGuard } from './refresh.guard';
import { RequestContextModule } from '@/modules/system/context/context.module';

@Controller('/refresh-guard')
class RefreshGuardController {
  @Post('/protected')
  @UseGuards(RefreshTokenGuard)
  refresh() {
    return { ok: true };
  }
}

describe('RefreshTokenGuard dependency injection', () => {
  let app: INestApplication;
  let passportCanActivateSpy: jest.SpyInstance;

  beforeAll(async () => {
    passportCanActivateSpy = jest
      .spyOn(Object.getPrototypeOf(RefreshTokenGuard.prototype), 'canActivate')
      .mockImplementation((...args: unknown[]) => {
        const [context] = args as [ExecutionContext];

        context.switchToHttp().getRequest().user = { sub: 'user_123' };

        return true;
      });

    const moduleRef = await Test.createTestingModule({
      imports: [RequestContextModule],
      controllers: [RefreshGuardController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    passportCanActivateSpy.mockRestore();
  });

  it('resolves RequestContext when the guard is used at route scope', async () => {
    await request(app.getHttpServer())
      .post('/refresh-guard/protected')
      .expect(201)
      .expect({ ok: true });
  });
});
