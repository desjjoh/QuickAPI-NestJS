import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { requestContextMiddleware } from '@/common/middleware/request-context.middleware';
import {
  attachRequestContext,
  RequestContext,
} from '@/common/store/request-context.store';
import { RouteContextInterceptor } from './route-context.interceptor';

@Controller('/route-context')
class RouteContextController {
  constructor(private readonly context: RequestContext) {}

  @Get('/static')
  staticRoute() {
    return { route: this.context.get('normalizedRoute') };
  }

  @Get('/items/:id')
  parameterRoute() {
    return { route: this.context.get('normalizedRoute') };
  }
}

describe(RouteContextInterceptor.name, () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [RouteContextController],
      providers: [
        RequestContext,
        { provide: APP_INTERCEPTOR, useClass: RouteContextInterceptor },
      ],
    }).compile();

    app = module.createNestApplication();
    const context = app.get(RequestContext);
    attachRequestContext(context);
    app.use(requestContextMiddleware());
    await app.init();
  });

  afterAll(async () => app.close());

  it('populates a public static route template without a query string', async () => {
    const response = await request(app.getHttpServer())
      .get('/route-context/static?include=details')
      .expect(200);

    expect(response.body.route).toBe('/route-context/static');
  });

  it('uses the parameter template instead of the concrete parameter value', async () => {
    const response = await request(app.getHttpServer())
      .get('/route-context/items/concrete-value')
      .expect(200);

    expect(response.body.route).toBe('/route-context/items/:id');
  });
});
