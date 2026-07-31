import type { NextFunction, Request, Response } from 'express';

import {
  attachRequestContext,
  RequestContext,
} from '../store/request-context.store';
import { requestContextMiddleware } from './request-context.middleware';

describe(requestContextMiddleware.name, () => {
  it('populates a safe anonymous HTTP context without the query string', () => {
    const context = new RequestContext();
    attachRequestContext(context);
    const request = {
      method: 'GET',
      path: '/users/123',
      originalUrl: '/users/123?token=secret',
      url: '/users/123?token=secret',
      ip: '127.0.0.1',
      get: (name: string) => (name === 'user-agent' ? 'test-agent' : undefined),
      headers: { authorization: 'Bearer secret', cookie: 'refresh=secret' },
      body: { password: 'secret' },
      query: { token: 'secret' },
    } as unknown as Request;

    requestContextMiddleware()(
      request,
      {} as Response,
      (() => {
        expect(context.getStore()).toEqual(
          expect.objectContaining({
            method: 'GET',
            ipAddress: '127.0.0.1',
            actorType: 'anonymous',
            userAgent: 'test-agent',
            source: 'http',
          }),
        );
        expect(context.getStore()).not.toHaveProperty('request');
        expect(context.getStore()).not.toHaveProperty('normalizedRoute');
      }) as NextFunction,
    );
  });
});
