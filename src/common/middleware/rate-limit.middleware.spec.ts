import type { NextFunction, Request, Response } from 'express';

import { TooManyRequestsError } from '@/common/exceptions/http.exception';

import { rateLimitMiddleware } from './rate-limit.middleware';

type MockRequestOptions = {
  ip?: string;
};

type MockResponse = {
  setHeader: jest.Mock;
};

function createRequest({ ip }: MockRequestOptions = {}): Request {
  return {
    ip,
  } as Request;
}

function createResponse(): MockResponse {
  return {
    setHeader: jest.fn(),
  };
}

function asResponse(res: MockResponse): Response {
  return res as unknown as Response;
}

function createNext(): jest.MockedFunction<NextFunction> {
  return jest.fn() as jest.MockedFunction<NextFunction>;
}

describe('rateLimitMiddleware', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('successful requests', () => {
    it('calls next when request count is under the limit', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 2,
      });

      const req = createRequest({ ip: '127.0.0.1' });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('allows requests equal to the configured limit', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 2,
      });

      const req = createRequest({ ip: '127.0.0.1' });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);
      mw(req, asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('uses req.ip as the default rate-limit key', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 1,
      });

      const firstReq = createRequest({ ip: '127.0.0.1' });
      const secondReq = createRequest({ ip: '127.0.0.2' });
      const res = createResponse();
      const next = createNext();

      mw(firstReq, asResponse(res), next);
      mw(secondReq, asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(2);
    });

    it('falls back to unknown when req.ip is missing', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 1,
      });

      const firstReq = createRequest();
      const secondReq = createRequest();
      const res = createResponse();
      const next = createNext();

      mw(firstReq, asResponse(res), next);

      expect(() => mw(secondReq, asResponse(res), next)).toThrow(
        'Too many requests',
      );

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('custom key generation', () => {
    it('uses keyGenerator when provided', () => {
      const keyGenerator = jest.fn(() => 'custom-key');

      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 1,
        keyGenerator,
      });

      const req = createRequest({ ip: '127.0.0.1' });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(keyGenerator).toHaveBeenCalledWith(req);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('rate-limits requests sharing the same custom key', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 1,
        keyGenerator: () => 'same-user',
      });

      const firstReq = createRequest({ ip: '127.0.0.1' });
      const secondReq = createRequest({ ip: '127.0.0.2' });
      const res = createResponse();
      const next = createNext();

      mw(firstReq, asResponse(res), next);

      expect(() => mw(secondReq, asResponse(res), next)).toThrow(
        'Too many requests',
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('does not rate-limit requests with different custom keys', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 1,
        keyGenerator: (req) => req.ip ?? 'unknown',
      });

      const firstReq = createRequest({ ip: '127.0.0.1' });
      const secondReq = createRequest({ ip: '127.0.0.2' });
      const res = createResponse();
      const next = createNext();

      mw(firstReq, asResponse(res), next);
      mw(secondReq, asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  describe('overflow behavior', () => {
    it('throws when request count exceeds the configured limit', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 1,
      });

      const req = createRequest({ ip: '127.0.0.1' });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(() => mw(req, asResponse(res), next)).toThrow(
        'Too many requests — limit is 1 per 1s.',
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('throws TooManyRequestsError when request count exceeds the configured limit', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 1,
      });

      const req = createRequest({ ip: '127.0.0.1' });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(() => mw(req, asResponse(res), next)).toThrow(
        TooManyRequestsError,
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('sets Retry-After header when request count exceeds the configured limit', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 1,
      });

      const req = createRequest({ ip: '127.0.0.1' });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(() => mw(req, asResponse(res), next)).toThrow('Too many requests');

      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '1');
    });

    it('uses windowMs divided by 1000 for Retry-After and error message seconds', () => {
      const mw = rateLimitMiddleware({
        windowMs: 5000,
        max: 1,
      });

      const req = createRequest({ ip: '127.0.0.1' });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(() => mw(req, asResponse(res), next)).toThrow(
        'Too many requests — limit is 1 per 5s.',
      );

      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '5');
    });

    it('does not call next when the request is rejected', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 1,
      });

      const req = createRequest({ ip: '127.0.0.1' });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(() => mw(req, asResponse(res), next)).toThrow();

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('window behavior', () => {
    it('allows requests again after the window expires', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 1,
      });

      const req = createRequest({ ip: '127.0.0.1' });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      jest.advanceTimersByTime(1001);

      mw(req, asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(2);
    });

    it('rejects requests still inside the window', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 1,
      });

      const req = createRequest({ ip: '127.0.0.1' });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      jest.advanceTimersByTime(999);

      expect(() => mw(req, asResponse(res), next)).toThrow('Too many requests');

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('drops timestamps outside the active window', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 2,
      });

      const req = createRequest({ ip: '127.0.0.1' });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      jest.advanceTimersByTime(500);
      mw(req, asResponse(res), next);

      jest.advanceTimersByTime(501);
      mw(req, asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(3);
    });

    it('keeps timestamps exactly at the window boundary out of the active window', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 1,
      });

      const req = createRequest({ ip: '127.0.0.1' });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      jest.advanceTimersByTime(1000);

      mw(req, asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  describe('rejected request accounting', () => {
    it('counts rejected requests in the active window with the current implementation', () => {
      const mw = rateLimitMiddleware({
        windowMs: 1000,
        max: 1,
      });

      const req = createRequest({ ip: '127.0.0.1' });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(() => mw(req, asResponse(res), next)).toThrow('Too many requests');
      expect(() => mw(req, asResponse(res), next)).toThrow('Too many requests');

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.setHeader).toHaveBeenCalledTimes(2);
    });
  });
});
