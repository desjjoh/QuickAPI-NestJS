import type { NextFunction, Request, Response } from 'express';

import { securityHeadersMiddleware } from './security-headers.middleware';

type MockRequestOptions = {
  originalUrl?: string;
  url?: string;
};

type MockResponse = {
  removeHeader: jest.Mock;
  setHeader: jest.Mock;
};

function createRequest({
  originalUrl,
  url = '/',
}: MockRequestOptions = {}): Request {
  return {
    originalUrl,
    url,
  } as Request;
}

function createResponse(): MockResponse {
  return {
    removeHeader: jest.fn(),
    setHeader: jest.fn(),
  };
}

function asResponse(res: MockResponse): Response {
  return res as unknown as Response;
}

function createNext(): jest.MockedFunction<NextFunction> {
  return jest.fn() as jest.MockedFunction<NextFunction>;
}

describe('securityHeadersMiddleware', () => {
  it('sets same-origin CORP for API routes', () => {
    const mw = securityHeadersMiddleware();
    const req = createRequest({ originalUrl: '/api/v1/library/countries' });
    const res = createResponse();
    const next = createNext();

    mw(req, asResponse(res), next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cross-Origin-Resource-Policy',
      'same-origin',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows static assets to be embedded cross-origin', () => {
    const mw = securityHeadersMiddleware();
    const req = createRequest({ originalUrl: '/flags/canada.svg' });
    const res = createResponse();
    const next = createNext();

    mw(req, asResponse(res), next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cross-Origin-Resource-Policy',
      'cross-origin',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
