import type { Request, Response, NextFunction, RequestHandler } from 'express';

import { RequestBodyTooLargeError } from '@/common/exceptions/http.exception';

export interface BodyLimitOptions {
  defaultLimit: number;
  routeOverrides?: Array<[string, number]>;
}

export function bodyLimitMiddleware(opts: BodyLimitOptions): RequestHandler {
  const defaultLimit: number = opts.defaultLimit;
  const routeOverrides: Array<[string, number]> = opts.routeOverrides ?? [];

  function selectLimit(path: string): number {
    for (const [prefix, limit] of routeOverrides) {
      if (path.startsWith(prefix)) return limit;
    }
    return defaultLimit;
  }

  return function bodyLimit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const limit: number = selectLimit(req.path);

    let total: number = 0;
    const chunks: Buffer[] = [];
    let limitExceeded: boolean = false;

    // Track incoming body size incrementally
    req.on('data', (chunk: Buffer) => {
      if (limitExceeded || res.headersSent) return;

      total += chunk.length;

      if (total > limit) {
        limitExceeded = true;

        // Stop reading further data
        req.pause();

        res.setHeader('X-Body-Limit-Bytes', String(limit));
        res.setHeader('X-Body-Remaining-Bytes', '0');

        next(
          new RequestBodyTooLargeError(
            `Request body exceeds limit of ${limit} bytes.`,
          ),
        );

        return;
      }

      chunks.push(chunk);
    });

    // Finalize headers once body completes
    req.on('end', () => {
      if (limitExceeded || res.headersSent) return;

      const remaining: number = Math.max(limit - total, 0);

      res.setHeader('X-Body-Limit-Bytes', String(limit));
      res.setHeader('X-Body-Remaining-Bytes', String(remaining));
    });

    next();
  };
}
