import {
  Controller,
  Get,
  INestApplication,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';
import request from 'supertest';
import { logger } from '@/config/logger.config';
import { requestContextMiddleware } from '../middleware/request-context.middleware';
import {
  attachRequestContext,
  RequestContext,
} from '../store/request-context.store';
import { GlobalExceptionFilter } from './global.filter';
import { NotFoundFilter } from './not-found.filter';

describe('HTTP failure privacy and correlation', () => {
  let app: INestApplication;
  const secret = 'private@example.test password=secret token=private-token';
  let log: jest.SpyInstance;

  @Controller()
  class Routes {
    @Get('database') database() {
      throw new QueryFailedError(
        `SELECT ${secret}`,
        [secret],
        new Error(secret),
      );
    }
    @Get('provider') provider() {
      throw Object.assign(new Error(secret), {
        response: { data: secret },
        config: { headers: { Authorization: secret } },
      });
    }
    @Get('wrapped') wrapped() {
      throw new InternalServerErrorException(secret);
    }
    @Get('private') private() {
      throw new UnauthorizedException('Sign in required');
    }
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [Routes],
    }).compile();
    app = module.createNestApplication();
    attachRequestContext(new RequestContext());
    app.use(requestContextMiddleware());
    app.useGlobalFilters(new GlobalExceptionFilter(), new NotFoundFilter());
    await app.init();
  });
  beforeEach(() => {
    log = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await app.close();
  });

  it.each(['database', 'provider', 'wrapped'])(
    'sanitizes %s failure and correlates response/header/log',
    async (route) => {
      const response = await request(app.getHttpServer())
        .get(`/${route}`)
        .set('X-Request-ID', secret)
        .expect(500);
      expect(response.body).toEqual({
        status: 500,
        message: 'Internal server error',
        timestamp: expect.any(Number),
        requestId: expect.any(String),
      });
      expect(response.body.requestId).not.toBe(secret);
      expect(response.headers['x-request-id']).toBe(response.body.requestId);
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: response.body.requestId }),
        'HTTP server failure.',
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
      expect(JSON.stringify(response.body)).not.toContain(secret);
    },
  );

  it('preserves intentional authorization responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/private')
      .expect(401);
    expect(response.body.message).toBe('Sign in required');
  });

  it('does not echo unknown-route query tokens into responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/unknown?token=private-token')
      .expect(404);
    expect(response.body.message).toBe('Route not found.');
    expect(JSON.stringify(response.body)).not.toContain('private-token');
  });
});
