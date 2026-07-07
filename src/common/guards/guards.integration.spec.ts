import {
  Controller,
  ForbiddenException,
  Get,
  INestApplication,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { APP_FILTER, Reflector } from '@nestjs/core';
import { RequestContext } from '../store/request-context.store';
import { TokenService } from '@/modules/system/tokens/services/token.service';

import { GlobalExceptionFilter } from '@/common/filters/global.filter';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { LocalAuthGuard } from '@/common/guards/local.guard';
import { RefreshTokenGuard } from '@/common/guards/refresh.guard';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';

@Controller('/protected')
class ProtectedController {
  @Get('/jwt')
  @UseGuards(JwtAuthGuard)
  jwt() {
    return { ok: true };
  }

  @Post('/local')
  @UseGuards(LocalAuthGuard)
  local() {
    return { ok: true };
  }

  @Post('/refresh')
  @UseGuards(RefreshTokenGuard)
  refresh() {
    return { ok: true };
  }

  @Post('/csrf')
  @UseGuards(CsrfGuard)
  csrf() {
    return { ok: true };
  }

  @Get('/permissions')
  @UseGuards(PermissionsGuard)
  perm() {
    return { ok: true };
  }
}

describe('Guard route integration and exception mapping', () => {
  let app: INestApplication;

  beforeAll(async () => {
    jest
      .spyOn(JwtAuthGuard.prototype, 'canActivate')
      .mockRejectedValue(new UnauthorizedException('invalid token'));
    jest
      .spyOn(LocalAuthGuard.prototype, 'canActivate')
      .mockResolvedValue(true as never);
    jest
      .spyOn(RefreshTokenGuard.prototype, 'canActivate')
      .mockRejectedValue(new UnauthorizedException('expired token'));
    jest.spyOn(CsrfGuard.prototype, 'canActivate').mockReturnValue(false);
    jest
      .spyOn(PermissionsGuard.prototype, 'canActivate')
      .mockRejectedValue(new ForbiddenException('permission denied'));

    const module = await Test.createTestingModule({
      controllers: [ProtectedController],
      providers: [
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
        { provide: RequestContext, useValue: { set: jest.fn() } },
        { provide: TokenService, useValue: { verifyCsrfToken: jest.fn() } },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('maps jwt guard errors to expected response shape', async () => {
    const res = await request(app.getHttpServer())
      .get('/protected/jwt')
      .expect(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 401,
        message: 'invalid token',
        timestamp: expect.any(Number),
      }),
    );
  });

  it('allows local guard route success path', async () => {
    await request(app.getHttpServer()).post('/protected/local').expect(201);
  });

  it('maps refresh errors', async () => {
    const res = await request(app.getHttpServer())
      .post('/protected/refresh')
      .expect(401);
    expect(res.body.message).toBe('expired token');
  });

  it('short-circuit false guard returns forbidden', async () => {
    const res = await request(app.getHttpServer())
      .post('/protected/csrf')
      .expect(403);
    expect(res.body).toEqual(expect.objectContaining({ status: 403 }));
  });

  it('maps permission denial', async () => {
    const res = await request(app.getHttpServer())
      .get('/protected/permissions')
      .expect(403);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: 403,
        message: 'permission denied',
      }),
    );
  });
});
