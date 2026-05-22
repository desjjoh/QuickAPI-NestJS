import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError } from '@/common/exceptions/http.exception';
import { corsMiddleware, CorsOptions } from './cors.middleware';

type MockRequestOptions = {
  method?: string;
  origin?: string;
};

type MockResponse = {
  setHeader: jest.Mock;
  status: jest.Mock;
  send: jest.Mock;
};

function createRequest({
  method = 'GET',
  origin,
}: MockRequestOptions = {}): Request {
  return {
    method,
    headers: origin ? { origin } : {},
  } as Request;
}

function createResponse(): MockResponse {
  const res: MockResponse = {
    setHeader: jest.fn(),
    status: jest.fn(),
    send: jest.fn(),
  };

  res.status.mockReturnValue(res);
  res.send.mockReturnValue(res);

  return res;
}

function asResponse(res: MockResponse): Response {
  return res as unknown as Response;
}

function createNext(): jest.MockedFunction<NextFunction> {
  return jest.fn() as jest.MockedFunction<NextFunction>;
}

function createOptions(overrides: Partial<CorsOptions> = {}): CorsOptions {
  return {
    origin: 'https://app.example.com',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['Authorization', 'Set-Cookie'],
    credentials: true,
    maxAge: 86400,
    ...overrides,
  };
}

describe('corsMiddleware', () => {
  describe('origin validation', () => {
    it('allows requests without an Origin header', () => {
      const mw = corsMiddleware(createOptions());
      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('allows a matching string origin', () => {
      const mw = corsMiddleware(
        createOptions({
          origin: 'https://app.example.com',
        }),
      );

      const req = createRequest({
        origin: 'https://app.example.com',
      });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://app.example.com',
      );
    });

    it('allows an origin included in the allowed origin array', () => {
      const mw = corsMiddleware(
        createOptions({
          origin: ['https://app.example.com', 'https://admin.example.com'],
        }),
      );

      const req = createRequest({
        origin: 'https://admin.example.com',
      });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://admin.example.com',
      );
    });

    it('allows any origin when origin is wildcard string', () => {
      const mw = corsMiddleware(
        createOptions({
          origin: '*',
        }),
      );

      const req = createRequest({
        origin: 'https://random.example.com',
      });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://random.example.com',
      );
    });

    it('allows any origin when origin array includes wildcard', () => {
      const mw = corsMiddleware(
        createOptions({
          origin: ['https://app.example.com', '*'],
        }),
      );

      const req = createRequest({
        origin: 'https://random.example.com',
      });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://random.example.com',
      );
    });

    it('throws when origin is not allowed', () => {
      const mw = corsMiddleware(
        createOptions({
          origin: 'https://app.example.com',
        }),
      );

      const req = createRequest({
        origin: 'https://evil.example.com',
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, asResponse(res), next)).toThrow(
        "CORS origin 'https://evil.example.com' not allowed.",
      );

      expect(next).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when origin is not allowed', () => {
      const mw = corsMiddleware(
        createOptions({
          origin: 'https://app.example.com',
        }),
      );

      const req = createRequest({
        origin: 'https://evil.example.com',
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, asResponse(res), next)).toThrow(ForbiddenError);
    });
  });

  describe('response headers', () => {
    it('sets standard CORS headers for allowed requests', () => {
      const mw = corsMiddleware(createOptions());
      const req = createRequest({
        origin: 'https://app.example.com',
      });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://app.example.com',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-CSRF-Token',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Expose-Headers',
        'Authorization, Set-Cookie',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Max-Age',
        '86400',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Credentials',
        'true',
      );
    });

    it('sets wildcard Access-Control-Allow-Origin when no Origin header exists and wildcard is allowed', () => {
      const mw = corsMiddleware(
        createOptions({
          origin: '*',
        }),
      );

      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        '*',
      );
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('sets wildcard Access-Control-Allow-Origin when no Origin header exists and origin array includes wildcard', () => {
      const mw = corsMiddleware(
        createOptions({
          origin: ['https://app.example.com', '*'],
        }),
      );

      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        '*',
      );
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('does not set Access-Control-Allow-Origin when no Origin header exists and wildcard is not allowed', () => {
      const mw = corsMiddleware(
        createOptions({
          origin: 'https://app.example.com',
        }),
      );

      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(res.setHeader).not.toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        expect.any(String),
      );
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('does not set Access-Control-Max-Age when maxAge is undefined', () => {
      const mw = corsMiddleware(
        createOptions({
          maxAge: undefined,
        }),
      );

      const req = createRequest({
        origin: 'https://app.example.com',
      });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(res.setHeader).not.toHaveBeenCalledWith(
        'Access-Control-Max-Age',
        expect.any(String),
      );
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('does not set Access-Control-Allow-Credentials when credentials is false', () => {
      const mw = corsMiddleware(
        createOptions({
          credentials: false,
        }),
      );

      const req = createRequest({
        origin: 'https://app.example.com',
      });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(res.setHeader).not.toHaveBeenCalledWith(
        'Access-Control-Allow-Credentials',
        expect.any(String),
      );
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('joins configured methods, allowed headers, and exposed headers', () => {
      const mw = corsMiddleware(
        createOptions({
          methods: ['GET', 'POST'],
          allowedHeaders: ['Content-Type'],
          exposedHeaders: ['Authorization'],
        }),
      );

      const req = createRequest({
        origin: 'https://app.example.com',
      });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'Content-Type',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Expose-Headers',
        'Authorization',
      );
    });
  });

  describe('preflight requests', () => {
    it('responds with 204 for OPTIONS requests', () => {
      const mw = corsMiddleware(createOptions());
      const req = createRequest({
        method: 'OPTIONS',
        origin: 'https://app.example.com',
      });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });

    it('sets CORS headers before ending OPTIONS requests', () => {
      const mw = corsMiddleware(createOptions());
      const req = createRequest({
        method: 'OPTIONS',
        origin: 'https://app.example.com',
      });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://app.example.com',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE',
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(next).not.toHaveBeenCalled();
    });

    it('throws for OPTIONS requests from disallowed origins', () => {
      const mw = corsMiddleware(createOptions());
      const req = createRequest({
        method: 'OPTIONS',
        origin: 'https://evil.example.com',
      });
      const res = createResponse();
      const next = createNext();

      expect(() => mw(req, asResponse(res), next)).toThrow(
        "CORS origin 'https://evil.example.com' not allowed.",
      );

      expect(res.status).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('normal requests', () => {
    it('calls next for non-OPTIONS requests', () => {
      const mw = corsMiddleware(createOptions());
      const req = createRequest({
        method: 'GET',
        origin: 'https://app.example.com',
      });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });

    it('treats lowercase options as a normal request with current implementation', () => {
      const mw = corsMiddleware(createOptions());
      const req = createRequest({
        method: 'options',
        origin: 'https://app.example.com',
      });
      const res = createResponse();
      const next = createNext();

      mw(req, asResponse(res), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });
  });
});
