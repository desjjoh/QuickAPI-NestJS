import type { Request, Response, NextFunction, RequestHandler } from 'express';

import { UnsupportedMediaTypeError } from '@/common/exceptions/http.exception';

export interface RouteOverride {
  prefix: string;
  allowed: string[];
}

export interface ContentTypeOptions {
  defaultAllowed?: string[];
  routeOverrides?: RouteOverride[];
}

const NO_BODY_METHODS: Set<string> = new Set([
  'GET',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

export function contentTypeMiddleware(
  opts: ContentTypeOptions,
): RequestHandler {
  const routeOverrides: RouteOverride[] = opts.routeOverrides ?? [];
  const defaultAllowed: Set<string> = new Set(
    (opts.defaultAllowed ?? ['application/json']).map((t) => t.toLowerCase()),
  );

  function getAllowedFor(path: string): Set<string> {
    for (const { prefix, allowed } of routeOverrides) {
      if (path.startsWith(prefix)) {
        return new Set(allowed.map((t) => t.toLowerCase()));
      }
    }

    return new Set(defaultAllowed);
  }

  return function contentType(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    const method: string = req.method.toUpperCase();
    const contentType = req.headers['content-type'];

    // Methods that must NOT send a body
    if (NO_BODY_METHODS.has(method)) {
      if (contentType !== undefined) {
        throw new UnsupportedMediaTypeError(
          `HTTP method '${method}' does not accept a request body.`,
        );
      }

      return next();
    }

    // Methods that MUST validate content-type
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      const allowed: Set<string> = getAllowedFor(req.path);

      // No Content-Type header found
      if (!contentType) {
        throw new UnsupportedMediaTypeError('Missing Content-Type header.');
      }

      const normalized: string = contentType.split(';')[0].trim().toLowerCase();

      // Content-Type not allowed
      if (!allowed.has(normalized)) {
        const expected: string[] = Array.from(allowed).sort();

        throw new UnsupportedMediaTypeError(
          `Content-Type '${contentType}' is not allowed. Expected one of: ${expected.join(', ')}.`,
        );
      }
    }

    next();
  };
}
