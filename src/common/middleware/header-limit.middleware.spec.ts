import type { NextFunction, Request, Response } from 'express';

import {
  RequestHeaderFieldsTooLargeError,
  UnsupportedTransferEncodingError,
} from '@/common/exceptions/http.exception';
import {
  HeaderLimits,
  headerLimitsMiddleware,
} from './header-limit.middleware';

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

function createLimits(overrides: Partial<HeaderLimits> = {}): HeaderLimits {
  return {
    maxHeaderCount: 100,
    maxSingleHeaderBytes: 4096,
    maxTotalHeaderBytes: 8192,
    allowChunked: false,
    ...overrides,
  };
}

describe('headerLimitsMiddleware', () => {
  describe('successful requests', () => {
    it('calls next when headers are within default limits', () => {
      const mw = headerLimitsMiddleware();
      const req = createRequest({
        headers: {
          host: 'localhost:4000',
          accept: 'application/json',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('calls next when headers are within custom limits', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          maxHeaderCount: 2,
          maxSingleHeaderBytes: 32,
          maxTotalHeaderBytes: 64,
        }),
      );

      const req = createRequest({
        headers: {
          accept: 'json',
          authorization: 'token',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('allows empty headers', () => {
      const mw = headerLimitsMiddleware();
      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('treats undefined header values as empty strings', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          maxSingleHeaderBytes: 16,
          maxTotalHeaderBytes: 16,
        }),
      );

      const req = createRequest({
        headers: {
          'x-empty': undefined,
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('header count limits', () => {
    it('throws when header count exceeds the configured limit', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          maxHeaderCount: 1,
        }),
      );

      const req = createRequest({
        headers: {
          accept: 'application/json',
          authorization: 'Bearer token',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow('Too many headers (limit = 1).');

      expect(next).not.toHaveBeenCalled();
    });

    it('throws RequestHeaderFieldsTooLargeError when header count exceeds the configured limit', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          maxHeaderCount: 1,
        }),
      );

      const req = createRequest({
        headers: {
          accept: 'application/json',
          authorization: 'Bearer token',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        RequestHeaderFieldsTooLargeError,
      );
    });

    it('allows header count equal to the configured limit', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          maxHeaderCount: 2,
        }),
      );

      const req = createRequest({
        headers: {
          accept: 'application/json',
          authorization: 'Bearer token',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('single header size limits', () => {
    it('throws when a single header exceeds the configured byte limit', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          maxSingleHeaderBytes: 10,
        }),
      );

      const req = createRequest({
        headers: {
          'x-test': '12345',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        'Header exceeds per-header size limit (10 bytes).',
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('throws RequestHeaderFieldsTooLargeError when a single header exceeds the configured byte limit', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          maxSingleHeaderBytes: 10,
        }),
      );

      const req = createRequest({
        headers: {
          'x-test': '12345',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        RequestHeaderFieldsTooLargeError,
      );
    });

    it('allows a single header equal to the configured byte limit', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          maxSingleHeaderBytes: 10,
        }),
      );

      const req = createRequest({
        headers: {
          'x-test': '1234',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('counts multibyte characters by bytes, not character length', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          maxSingleHeaderBytes: 9,
        }),
      );

      const req = createRequest({
        headers: {
          'x-test': 'éé',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        'Header exceeds per-header size limit (9 bytes).',
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('checks each value in an array header independently against the per-header limit', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          maxSingleHeaderBytes: 10,
          maxTotalHeaderBytes: 100,
        }),
      );

      const req = createRequest({
        headers: {
          'x-test': ['1234', '56789'],
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        'Header exceeds per-header size limit (10 bytes).',
      );

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('total header size limits', () => {
    it('throws when total header size exceeds the configured byte limit', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          maxSingleHeaderBytes: 100,
          maxTotalHeaderBytes: 20,
        }),
      );

      const req = createRequest({
        headers: {
          'x-one': '12345',
          'x-two': '67890',
          'x-three': 'abc',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        'Total header size exceeds limit (20 bytes).',
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('throws RequestHeaderFieldsTooLargeError when total header size exceeds the configured byte limit', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          maxSingleHeaderBytes: 100,
          maxTotalHeaderBytes: 20,
        }),
      );

      const req = createRequest({
        headers: {
          'x-one': '12345',
          'x-two': '67890',
          'x-three': 'abc',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        RequestHeaderFieldsTooLargeError,
      );
    });

    it('allows total header size equal to the configured byte limit', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          maxSingleHeaderBytes: 100,
          maxTotalHeaderBytes: 20,
        }),
      );

      const req = createRequest({
        headers: {
          'x-one': '12345',
          'x-two': '67890',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('adds all values in an array header to the total byte count', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          maxSingleHeaderBytes: 100,
          maxTotalHeaderBytes: 15,
        }),
      );

      const req = createRequest({
        headers: {
          'x-test': ['1234', '5678'],
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        'Total header size exceeds limit (15 bytes).',
      );

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('transfer encoding limits', () => {
    it('throws when chunked transfer encoding is present and chunked is not allowed', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          allowChunked: false,
        }),
      );

      const req = createRequest({
        headers: {
          'transfer-encoding': 'chunked',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        'Chunked request bodies are not allowed.',
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('throws UnsupportedTransferEncodingError when chunked transfer encoding is present and chunked is not allowed', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          allowChunked: false,
        }),
      );

      const req = createRequest({
        headers: {
          'transfer-encoding': 'chunked',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        UnsupportedTransferEncodingError,
      );
    });

    it('matches chunked transfer encoding case-insensitively', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          allowChunked: false,
        }),
      );

      const req = createRequest({
        headers: {
          'transfer-encoding': 'GZip, Chunked',
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        'Chunked request bodies are not allowed.',
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('rejects array transfer-encoding values containing chunked', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          allowChunked: false,
        }),
      );

      const req = createRequest({
        headers: {
          'transfer-encoding': ['gzip', 'chunked'],
        },
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, res, next)).toThrow(
        'Chunked request bodies are not allowed.',
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('allows chunked transfer encoding when configured', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          allowChunked: true,
        }),
      );

      const req = createRequest({
        headers: {
          'transfer-encoding': 'chunked',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('allows array transfer-encoding values containing chunked when configured', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          allowChunked: true,
        }),
      );

      const req = createRequest({
        headers: {
          'transfer-encoding': ['gzip', 'chunked'],
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('allows non-chunked transfer encoding values', () => {
      const mw = headerLimitsMiddleware(
        createLimits({
          allowChunked: false,
        }),
      );

      const req = createRequest({
        headers: {
          'transfer-encoding': 'compress',
        },
      });
      const res = createResponse();
      const next = createNext();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
