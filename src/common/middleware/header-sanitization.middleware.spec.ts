import type { NextFunction, Request, Response } from 'express';

import { BadRequestError } from '@/common/exceptions/http.exception';
import { sanitizeHeadersMiddleware } from './header-sanitization.middleware';

type MockHeaders = Record<string, string | string[] | undefined>;

type MockRequestOptions = {
  headers?: MockHeaders;
};

function createRequest({ headers = {} }: MockRequestOptions = {}): Request {
  return {
    headers,
  } as unknown as Request;
}

function createResponse(): Response {
  return {} as Response;
}

function createNext(): jest.MockedFunction<NextFunction> {
  return jest.fn() as jest.MockedFunction<NextFunction>;
}

describe('sanitizeHeadersMiddleware', () => {
  describe('successful requests', () => {
    it('calls next when headers are valid and allowed', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          host: 'localhost:4000',
          accept: 'application/json',
          authorization: 'Bearer token',
          'x-csrf-token': 'csrf-token',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('normalizes allowed header names to lowercase', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          Host: 'localhost:4000',
          Accept: 'application/json',
          Authorization: 'Bearer token',
          'X-CSRF-Token': 'csrf-token',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(req.headers).toEqual({
        host: 'localhost:4000',
        accept: 'application/json',
        authorization: 'Bearer token',
        'x-csrf-token': 'csrf-token',
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('preserves array values for allowed headers', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          accept: ['application/json', 'text/plain'],
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(req.headers).toEqual({
        accept: ['application/json', 'text/plain'],
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('converts undefined allowed header values to empty strings', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          accept: undefined,
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(req.headers).toEqual({
        accept: '',
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('removes headers that are not explicitly allowed', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          accept: 'application/json',
          'x-random-header': 'ignored',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(req.headers).toEqual({
        accept: 'application/json',
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('allows all configured browser/security headers in the allowlist', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          host: 'localhost:4000',
          connection: 'close',
          'content-type': 'application/json',
          'content-length': '100',
          accept: 'application/json',
          'accept-language': 'en-CA',
          'accept-encoding': 'gzip',
          'user-agent': 'Jest',
          referer: 'https://app.example.com',
          origin: 'https://app.example.com',
          cookie: 'refresh_token=abc',
          'sec-fetch-site': 'same-site',
          'sec-fetch-mode': 'cors',
          'sec-fetch-dest': 'empty',
          'sec-ch-ua': '"Firefox"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          authorization: 'Bearer token',
          'x-csrf-token': 'csrf-token',
          'x-request-id': 'request-id',
          'x-api-key': 'api-key',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(req.headers).toEqual({
        host: 'localhost:4000',
        connection: 'close',
        'content-type': 'application/json',
        'content-length': '100',
        accept: 'application/json',
        'accept-language': 'en-CA',
        'accept-encoding': 'gzip',
        'user-agent': 'Jest',
        referer: 'https://app.example.com',
        origin: 'https://app.example.com',
        cookie: 'refresh_token=abc',
        'sec-fetch-site': 'same-site',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'sec-ch-ua': '"Firefox"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        authorization: 'Bearer token',
        'x-csrf-token': 'csrf-token',
        'x-request-id': 'request-id',
        'x-api-key': 'api-key',
      });
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('blocked headers', () => {
    it.each([
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailer',
      'transfer-encoding',
      'upgrade',
      'proxy-connection',
      'x-forwarded-for',
      'x-forwarded-host',
      'x-forwarded-proto',
      'forwarded',
      'via',
      'client-ip',
      'true-client-ip',
    ])("throws when blocked header '%s' is present", (headerName) => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          [headerName]: 'blocked',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        `Header '${headerName}' is not allowed.`,
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('matches blocked headers case-insensitively', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          'X-Forwarded-For': '127.0.0.1',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        "Header 'x-forwarded-for' is not allowed.",
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('throws BadRequestError for blocked headers', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          'transfer-encoding': 'chunked',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(BadRequestError);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('duplicate headers', () => {
    it('throws when duplicate headers exist after lowercase normalization', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          Accept: 'application/json',
          accept: 'text/plain',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        "Duplicate header 'accept' is not permitted.",
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('throws BadRequestError for duplicate headers', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          Authorization: 'Bearer one',
          authorization: 'Bearer two',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(BadRequestError);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('header name validation', () => {
    it.each([
      'bad_header',
      'bad header',
      'bad.header',
      'bad:header',
      'bad/header',
      'bad@header',
    ])("throws when header name '%s' contains invalid characters", (name) => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          [name]: 'value',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        `Header name '${name}' contains invalid characters.`,
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when a header name contains invalid characters', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          bad_header: 'value',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(BadRequestError);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('header value validation', () => {
    it('throws when a header value contains a carriage return', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          accept: 'application/json\rmalicious',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        'Header value contains prohibited control characters.',
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('throws when a header value contains a line feed', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          accept: 'application/json\nmalicious',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        'Header value contains prohibited control characters.',
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('throws when any value in an array header contains prohibited control characters', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          accept: ['application/json', 'text/plain\nmalicious'],
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        'Header value contains prohibited control characters.',
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when a header value contains prohibited control characters', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          accept: 'application/json\rmalicious',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(BadRequestError);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('request mutation', () => {
    it('replaces req.headers with the cleaned header object', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          Host: 'localhost:4000',
          Accept: 'application/json',
          'x-random-header': 'ignored',
        },
      });
      const originalHeaders = req.headers;
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(req.headers).not.toBe(originalHeaders);
      expect(req.headers).toEqual({
        host: 'localhost:4000',
        accept: 'application/json',
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('sets req.headers to an empty object when no headers are allowed', () => {
      const mw = sanitizeHeadersMiddleware();
      const req = createRequest({
        headers: {
          'x-random-header': 'ignored',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(req.headers).toEqual({});
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
