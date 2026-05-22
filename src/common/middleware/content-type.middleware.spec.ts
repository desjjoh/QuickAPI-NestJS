import type { NextFunction, Request, Response } from 'express';

import { UnsupportedMediaTypeError } from '@/common/exceptions/http.exception';
import { contentTypeMiddleware } from './content-type.middleware';

type MockRequestOptions = {
  method: string;
  path?: string;
  contentType?: string;
};

function createRequest({
  method,
  path = '/',
  contentType,
}: MockRequestOptions): Request {
  return {
    method,
    path,
    headers: contentType ? { 'content-type': contentType } : {},
  } as Request;
}

function createResponse(): Response {
  return {} as Response;
}

function createNext(): jest.MockedFunction<NextFunction> {
  return jest.fn() as jest.MockedFunction<NextFunction>;
}

describe('contentTypeMiddleware', () => {
  describe('methods that do not accept request bodies', () => {
    it.each(['GET', 'DELETE', 'HEAD', 'OPTIONS'])(
      'passes %s when Content-Type is not present',
      (method) => {
        const next = createNext();
        const mw = contentTypeMiddleware({});

        mw(createRequest({ method }), createResponse(), next);

        expect(next).toHaveBeenCalledTimes(1);
      },
    );

    it.each(['GET', 'DELETE', 'HEAD', 'OPTIONS'])(
      'throws for %s when Content-Type is present',
      (method) => {
        const next = createNext();
        const mw = contentTypeMiddleware({});

        expect(() =>
          mw(
            createRequest({
              method,
              contentType: 'application/json',
            }),
            createResponse(),
            next,
          ),
        ).toThrow(`HTTP method '${method}' does not accept a request body.`);

        expect(next).not.toHaveBeenCalled();
      },
    );

    it('throws UnsupportedMediaTypeError for no-body methods with Content-Type', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({});

      expect(() =>
        mw(
          createRequest({
            method: 'GET',
            contentType: 'application/json',
          }),
          createResponse(),
          next,
        ),
      ).toThrow(UnsupportedMediaTypeError);
    });
  });

  describe('methods that validate Content-Type', () => {
    it.each(['POST', 'PUT', 'PATCH'])(
      'throws for %s when Content-Type is missing',
      (method) => {
        const next = createNext();
        const mw = contentTypeMiddleware({});

        expect(() =>
          mw(createRequest({ method }), createResponse(), next),
        ).toThrow('Missing Content-Type header.');

        expect(next).not.toHaveBeenCalled();
      },
    );

    it.each(['POST', 'PUT', 'PATCH'])(
      'passes %s with default application/json Content-Type',
      (method) => {
        const next = createNext();
        const mw = contentTypeMiddleware({});

        mw(
          createRequest({
            method,
            contentType: 'application/json',
          }),
          createResponse(),
          next,
        );

        expect(next).toHaveBeenCalledTimes(1);
      },
    );

    it('normalizes Content-Type casing', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({});

      mw(
        createRequest({
          method: 'POST',
          contentType: 'Application/JSON',
        }),
        createResponse(),
        next,
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('strips Content-Type parameters before validation', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({});

      mw(
        createRequest({
          method: 'POST',
          contentType: 'application/json; charset=utf-8',
        }),
        createResponse(),
        next,
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('trims normalized Content-Type before validation', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({});

      mw(
        createRequest({
          method: 'POST',
          contentType: ' application/json ; charset=utf-8',
        }),
        createResponse(),
        next,
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('throws when Content-Type is not allowed', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({});

      expect(() =>
        mw(
          createRequest({
            method: 'POST',
            contentType: 'text/plain',
          }),
          createResponse(),
          next,
        ),
      ).toThrow(
        "Content-Type 'text/plain' is not allowed. Expected one of: application/json.",
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('throws UnsupportedMediaTypeError when Content-Type is not allowed', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({});

      expect(() =>
        mw(
          createRequest({
            method: 'POST',
            contentType: 'text/plain',
          }),
          createResponse(),
          next,
        ),
      ).toThrow(UnsupportedMediaTypeError);
    });

    it('sorts expected Content-Type values in error messages', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({
        defaultAllowed: ['multipart/form-data', 'application/json'],
      });

      expect(() =>
        mw(
          createRequest({
            method: 'POST',
            contentType: 'text/plain',
          }),
          createResponse(),
          next,
        ),
      ).toThrow(
        "Content-Type 'text/plain' is not allowed. Expected one of: application/json, multipart/form-data.",
      );

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('default allowed content types', () => {
    it('uses custom default allowed content types', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({
        defaultAllowed: ['multipart/form-data'],
      });

      mw(
        createRequest({
          method: 'POST',
          contentType: 'multipart/form-data; boundary=abc123',
        }),
        createResponse(),
        next,
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('normalizes custom default allowed content types', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({
        defaultAllowed: ['Application/JSON'],
      });

      mw(
        createRequest({
          method: 'POST',
          contentType: 'application/json',
        }),
        createResponse(),
        next,
      );

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('route overrides', () => {
    it('uses route override when request path starts with prefix', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({
        defaultAllowed: ['application/json'],
        routeOverrides: [
          {
            prefix: '/uploads',
            allowed: ['multipart/form-data'],
          },
        ],
      });

      mw(
        createRequest({
          method: 'POST',
          path: '/uploads/avatar',
          contentType: 'multipart/form-data; boundary=abc123',
        }),
        createResponse(),
        next,
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('rejects default Content-Type when matching route override does not allow it', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({
        defaultAllowed: ['application/json'],
        routeOverrides: [
          {
            prefix: '/uploads',
            allowed: ['multipart/form-data'],
          },
        ],
      });

      expect(() =>
        mw(
          createRequest({
            method: 'POST',
            path: '/uploads/avatar',
            contentType: 'application/json',
          }),
          createResponse(),
          next,
        ),
      ).toThrow(
        "Content-Type 'application/json' is not allowed. Expected one of: multipart/form-data.",
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('falls back to default allowed types when no route override matches', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({
        defaultAllowed: ['application/json'],
        routeOverrides: [
          {
            prefix: '/uploads',
            allowed: ['multipart/form-data'],
          },
        ],
      });

      mw(
        createRequest({
          method: 'POST',
          path: '/account/profile',
          contentType: 'application/json',
        }),
        createResponse(),
        next,
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('normalizes route override allowed content types', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({
        routeOverrides: [
          {
            prefix: '/uploads',
            allowed: ['Multipart/Form-Data'],
          },
        ],
      });

      mw(
        createRequest({
          method: 'POST',
          path: '/uploads/avatar',
          contentType: 'multipart/form-data; boundary=abc123',
        }),
        createResponse(),
        next,
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('uses the first matching route override', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({
        routeOverrides: [
          {
            prefix: '/uploads',
            allowed: ['multipart/form-data'],
          },
          {
            prefix: '/uploads/avatar',
            allowed: ['application/json'],
          },
        ],
      });

      expect(() =>
        mw(
          createRequest({
            method: 'POST',
            path: '/uploads/avatar',
            contentType: 'application/json',
          }),
          createResponse(),
          next,
        ),
      ).toThrow(
        "Content-Type 'application/json' is not allowed. Expected one of: multipart/form-data.",
      );

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('other HTTP methods', () => {
    it('passes unknown methods without validating Content-Type', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({});

      mw(
        createRequest({
          method: 'TRACE',
          contentType: 'text/plain',
        }),
        createResponse(),
        next,
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('normalizes method casing', () => {
      const next = createNext();
      const mw = contentTypeMiddleware({});

      mw(
        createRequest({
          method: 'post',
          contentType: 'application/json',
        }),
        createResponse(),
        next,
      );

      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
