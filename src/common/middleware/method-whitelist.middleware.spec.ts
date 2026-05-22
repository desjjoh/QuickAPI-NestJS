import type { NextFunction, Request, Response } from 'express';

import { MethodNotAllowedError } from '@/common/exceptions/http.exception';

import { methodWhitelistMiddleware } from './method-whitelist.middleware';

type MockRequestOptions = {
  method: string;
};

function createRequest({ method }: MockRequestOptions): Request {
  return {
    method,
  } as Request;
}

function createResponse(): Response {
  return {} as Response;
}

function createNext(): jest.MockedFunction<NextFunction> {
  return jest.fn() as jest.MockedFunction<NextFunction>;
}

describe('methodWhitelistMiddleware', () => {
  describe('allowed methods', () => {
    it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])(
      'allows configured method %s',
      (method) => {
        const mw = methodWhitelistMiddleware({
          allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        });

        const req = createRequest({ method });
        const res = createResponse();
        const next = createNext();

        mw(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
      },
    );

    it('normalizes configured methods to uppercase', () => {
      const mw = methodWhitelistMiddleware({
        allowedMethods: ['get', 'post'],
      });

      const req = createRequest({ method: 'POST' });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('normalizes request method to uppercase', () => {
      const mw = methodWhitelistMiddleware({
        allowedMethods: ['POST'],
      });

      const req = createRequest({ method: 'post' });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('calls next exactly once for an allowed method', () => {
      const mw = methodWhitelistMiddleware({
        allowedMethods: ['GET'],
      });

      const req = createRequest({ method: 'GET' });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('always allowed methods', () => {
    it('always allows HEAD even when not configured', () => {
      const mw = methodWhitelistMiddleware({
        allowedMethods: [],
      });

      const req = createRequest({ method: 'HEAD' });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('always allows OPTIONS even when not configured', () => {
      const mw = methodWhitelistMiddleware({
        allowedMethods: [],
      });

      const req = createRequest({ method: 'OPTIONS' });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('normalizes always allowed request methods', () => {
      const mw = methodWhitelistMiddleware({
        allowedMethods: [],
      });

      const req = createRequest({ method: 'options' });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('rejected methods', () => {
    it('throws when method is not configured or always allowed', () => {
      const mw = methodWhitelistMiddleware({
        allowedMethods: ['GET', 'POST'],
      });

      const req = createRequest({ method: 'DELETE' });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        "HTTP method 'DELETE' is not allowed. Allowed methods: GET, POST.",
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('throws MethodNotAllowedError when method is not allowed', () => {
      const mw = methodWhitelistMiddleware({
        allowedMethods: ['GET'],
      });

      const req = createRequest({ method: 'POST' });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(MethodNotAllowedError);
      expect(next).not.toHaveBeenCalled();
    });

    it('reports normalized request method in the error message', () => {
      const mw = methodWhitelistMiddleware({
        allowedMethods: ['GET'],
      });

      const req = createRequest({ method: 'post' });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        "HTTP method 'POST' is not allowed. Allowed methods: GET.",
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('reports normalized configured methods in the error message', () => {
      const mw = methodWhitelistMiddleware({
        allowedMethods: ['get', 'post'],
      });

      const req = createRequest({ method: 'PATCH' });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        "HTTP method 'PATCH' is not allowed. Allowed methods: GET, POST.",
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('handles an empty configured method list in the error message', () => {
      const mw = methodWhitelistMiddleware({
        allowedMethods: [],
      });

      const req = createRequest({ method: 'POST' });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        "HTTP method 'POST' is not allowed. Allowed methods: none.",
      );

      expect(next).not.toHaveBeenCalled();
    });
  });
});
