import type { NextFunction, Request, Response } from 'express';

import { rateLimitMiddleware } from './rate-limit.middleware';

describe('rateLimitMiddleware', () => {
  it('uses keyGenerator and enforces retry header on overflow', () => {
    const mw = rateLimitMiddleware({
      windowMs: 1000,
      max: 1,
      keyGenerator: () => 'k1',
    });

    const req = { ip: 'x' } as Request;
    const res: Pick<Response, 'setHeader'> = {
      setHeader: jest.fn(),
    };
    const next = jest.fn() as NextFunction;

    mw(req, res as Response, next);

    expect(() => mw(req, res as Response, next)).toThrow('Too many requests');
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '1');
  });
});
