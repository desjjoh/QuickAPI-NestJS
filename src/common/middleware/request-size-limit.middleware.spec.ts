import { BadRequestException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { EventEmitter } from 'events';

import { RequestBodyTooLargeError } from '@/common/exceptions/http.exception';

import {
  BodyLimitOptions,
  bodyLimitMiddleware,
} from './request-size-limit.middleware';

type MockHeaders = Record<string, string | string[] | undefined>;

type MockRequestOptions = {
  path?: string;
  headers?: MockHeaders;
};

type MockRequest = EventEmitter & {
  headers: MockHeaders;
  path: string;
  body: unknown;
  pause: jest.Mock;
};

type MockResponse = {
  setHeader: jest.Mock;
};

function createRequest({
  path = '/',
  headers = {},
}: MockRequestOptions = {}): MockRequest {
  return Object.assign(new EventEmitter(), {
    path,
    headers,
    body: undefined,
    pause: jest.fn(),
  }) as MockRequest;
}

function asRequest(req: MockRequest): Request {
  return req as unknown as Request;
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

function expectNextSuccess(next: jest.MockedFunction<NextFunction>): void {
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0][0]).toBeUndefined();
}

function createOptions(
  overrides: Partial<BodyLimitOptions> = {},
): BodyLimitOptions {
  return {
    defaultLimit: 20,
    ...overrides,
  };
}

function emitData(req: MockRequest, value: string): void {
  req.emit('data', Buffer.from(value, 'utf8'));
}

function emitEnd(req: MockRequest): void {
  req.emit('end');
}

describe('bodyLimitMiddleware', () => {
  describe('non-JSON requests', () => {
    it('calls next immediately for requests without Content-Type', () => {
      const mw = bodyLimitMiddleware(createOptions());
      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('calls next immediately for non-JSON Content-Type', () => {
      const mw = bodyLimitMiddleware(createOptions());
      const req = createRequest({
        headers: {
          'content-type': 'multipart/form-data',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('calls next immediately when Content-Type is not a string', () => {
      const mw = bodyLimitMiddleware(createOptions());
      const req = createRequest({
        headers: {
          'content-type': ['application/json'],
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('JSON detection', () => {
    it('handles application/json requests', () => {
      const mw = bodyLimitMiddleware(createOptions());
      const req = createRequest({
        headers: {
          'content-type': 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"ok":true}');
      emitEnd(req);

      expect(req.body).toEqual({ ok: true });
      expectNextSuccess(next);
    });

    it('handles Content-Type casing', () => {
      const mw = bodyLimitMiddleware(createOptions());
      const req = createRequest({
        headers: {
          'content-type': 'Application/JSON',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"ok":true}');
      emitEnd(req);

      expect(req.body).toEqual({ ok: true });
      expectNextSuccess(next);
    });

    it('handles vendor +json requests', () => {
      const mw = bodyLimitMiddleware(createOptions());
      const req = createRequest({
        headers: {
          'content-type': 'application/vnd.api+json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"ok":true}');
      emitEnd(req);

      expect(req.body).toEqual({ ok: true });
      expectNextSuccess(next);
    });
  });

  describe('limit selection', () => {
    it('uses the default limit when no route override matches', () => {
      const mw = bodyLimitMiddleware(
        createOptions({
          defaultLimit: 10,
          routeOverrides: [['/large', 100]],
        }),
      );

      const req = createRequest({
        path: '/normal',
        headers: {
          'content-type': 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"abc":1}');
      emitEnd(req);

      expect(res.setHeader).toHaveBeenCalledWith('X-Body-Limit-Bytes', '10');
      expectNextSuccess(next);
    });

    it('uses a route override when the request path starts with the override prefix', () => {
      const mw = bodyLimitMiddleware(
        createOptions({
          defaultLimit: 10,
          routeOverrides: [['/large', 100]],
        }),
      );

      const req = createRequest({
        path: '/large/import',
        headers: {
          'content-type': 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"abc":1}');
      emitEnd(req);

      expect(res.setHeader).toHaveBeenCalledWith('X-Body-Limit-Bytes', '100');
      expectNextSuccess(next);
    });

    it('uses the first matching route override', () => {
      const mw = bodyLimitMiddleware(
        createOptions({
          defaultLimit: 10,
          routeOverrides: [
            ['/api', 30],
            ['/api/upload', 100],
          ],
        }),
      );

      const req = createRequest({
        path: '/api/upload',
        headers: {
          'content-type': 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"abc":1}');
      emitEnd(req);

      expect(res.setHeader).toHaveBeenCalledWith('X-Body-Limit-Bytes', '30');
      expectNextSuccess(next);
    });
  });

  describe('declared Content-Length enforcement', () => {
    it('rejects before reading stream when declared Content-Length exceeds limit', () => {
      const mw = bodyLimitMiddleware(
        createOptions({
          defaultLimit: 10,
        }),
      );

      const req = createRequest({
        headers: {
          'content-type': 'application/json',
          'content-length': '11',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(RequestBodyTooLargeError);
      expect(next.mock.calls[0][0]).toMatchObject({
        message: 'Request body exceeds limit of 10 bytes.',
      });
      expect(res.setHeader).toHaveBeenCalledWith('X-Body-Limit-Bytes', '10');
      expect(res.setHeader).toHaveBeenCalledWith('X-Body-Actual-Bytes', '0');
      expect(res.setHeader).toHaveBeenCalledWith('X-Body-Remaining-Bytes', '0');
    });

    it('does not pre-reject when declared Content-Length equals actual body length within limit', () => {
      const mw = bodyLimitMiddleware(
        createOptions({
          defaultLimit: 10,
        }),
      );

      const body = '{"abc":1}';

      const req = createRequest({
        headers: {
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(body)),
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, body);
      emitEnd(req);

      expect(req.body).toEqual({ abc: 1 });
      expectNextSuccess(next);
    });

    it('ignores invalid Content-Length values for mismatch checks', () => {
      const mw = bodyLimitMiddleware(createOptions());

      const req = createRequest({
        headers: {
          'content-type': 'application/json',
          'content-length': 'not-a-number',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"ok":true}');
      emitEnd(req);

      expect(req.body).toEqual({ ok: true });
      expectNextSuccess(next);
    });

    it('ignores negative Content-Length values for mismatch checks', () => {
      const mw = bodyLimitMiddleware(createOptions());

      const req = createRequest({
        headers: {
          'content-type': 'application/json',
          'content-length': '-1',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"ok":true}');
      emitEnd(req);

      expect(req.body).toEqual({ ok: true });
      expectNextSuccess(next);
    });
  });

  describe('streamed body limit enforcement', () => {
    it('rejects when streamed body exceeds the limit', () => {
      const mw = bodyLimitMiddleware(
        createOptions({
          defaultLimit: 5,
        }),
      );

      const req = createRequest({
        headers: {
          'content-type': 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"too":');
      emitData(req, '"large"}');

      expect(req.pause).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(RequestBodyTooLargeError);
      expect(next.mock.calls[0][0]).toMatchObject({
        message: 'Request body exceeds limit of 5 bytes.',
      });
      expect(res.setHeader).toHaveBeenCalledWith('X-Body-Actual-Bytes', '7');
      expect(res.setHeader).toHaveBeenCalledWith('X-Body-Remaining-Bytes', '0');
    });

    it('ignores further data after completion', () => {
      const mw = bodyLimitMiddleware(
        createOptions({
          defaultLimit: 5,
        }),
      );

      const req = createRequest({
        headers: {
          'content-type': 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"too":');
      emitData(req, '"large"}');
      emitEnd(req);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('successful body parsing', () => {
    it('parses valid JSON into req.body', () => {
      const mw = bodyLimitMiddleware(createOptions());
      const req = createRequest({
        headers: {
          'content-type': 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"name":"Maple"}');
      emitEnd(req);

      expect(req.body).toEqual({ name: 'Maple' });
      expectNextSuccess(next);
    });

    it('parses JSON across multiple chunks', () => {
      const mw = bodyLimitMiddleware(createOptions());
      const req = createRequest({
        headers: {
          'content-type': 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"name":');
      emitData(req, '"Maple"}');
      emitEnd(req);

      expect(req.body).toEqual({ name: 'Maple' });
      expectNextSuccess(next);
    });

    it('sets body to empty object when actual body length is zero', () => {
      const mw = bodyLimitMiddleware(createOptions());
      const req = createRequest({
        headers: {
          'content-type': 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitEnd(req);

      expect(req.body).toEqual({});
      expectNextSuccess(next);
    });

    it('sets actual and remaining byte headers after successful parse', () => {
      const mw = bodyLimitMiddleware(
        createOptions({
          defaultLimit: 20,
        }),
      );

      const req = createRequest({
        headers: {
          'content-type': 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"ok":true}');
      emitEnd(req);

      expect(res.setHeader).toHaveBeenCalledWith('X-Body-Limit-Bytes', '20');
      expect(res.setHeader).toHaveBeenCalledWith('X-Body-Actual-Bytes', '11');
      expect(res.setHeader).toHaveBeenCalledWith('X-Body-Remaining-Bytes', '9');
      expectNextSuccess(next);
    });
  });

  describe('body validation failures', () => {
    it('rejects invalid JSON', () => {
      const mw = bodyLimitMiddleware(createOptions());
      const req = createRequest({
        headers: {
          'content-type': 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"broken":');
      emitEnd(req);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(BadRequestException);
      expect(next.mock.calls[0][0]).toMatchObject({
        message: 'Invalid JSON request body.',
      });
    });

    it('rejects when declared Content-Length does not match actual body length', () => {
      const mw = bodyLimitMiddleware(createOptions());

      const req = createRequest({
        headers: {
          'content-type': 'application/json',
          'content-length': '12',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"ok":true}');
      emitEnd(req);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(BadRequestException);
      expect(next.mock.calls[0][0]).toMatchObject({
        message:
          'Request body length mismatch. Expected 12 bytes but received 11 bytes.',
      });
    });

    it('sets byte headers before rejecting Content-Length mismatch', () => {
      const mw = bodyLimitMiddleware(
        createOptions({
          defaultLimit: 20,
        }),
      );

      const req = createRequest({
        headers: {
          'content-type': 'application/json',
          'content-length': '12',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      emitData(req, '{"ok":true}');
      emitEnd(req);

      expect(res.setHeader).toHaveBeenCalledWith('X-Body-Actual-Bytes', '11');
      expect(res.setHeader).toHaveBeenCalledWith('X-Body-Remaining-Bytes', '9');
      expect(next.mock.calls[0][0]).toBeInstanceOf(BadRequestException);
    });
  });

  describe('stream errors', () => {
    it('passes stream errors to next', () => {
      const mw = bodyLimitMiddleware(createOptions());

      const req = createRequest({
        headers: {
          'content-type': 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();
      const error = new Error('stream failed');

      mw(asRequest(req), asResponse(res), next);

      req.emit('error', error);

      expect(next).toHaveBeenCalledWith(error);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('passes aborted requests to next as BadRequestException', () => {
      const mw = bodyLimitMiddleware(createOptions());

      const req = createRequest({
        headers: {
          'content-type': 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      req.emit('aborted');

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(BadRequestException);
      expect(next.mock.calls[0][0]).toMatchObject({
        message: 'Request body was aborted.',
      });
    });

    it('only calls next once if multiple terminal events occur', () => {
      const mw = bodyLimitMiddleware(createOptions());

      const req = createRequest({
        headers: {
          'content-type': 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(asRequest(req), asResponse(res), next);

      req.emit('error', new Error('stream failed'));
      req.emit('aborted');
      emitEnd(req);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
