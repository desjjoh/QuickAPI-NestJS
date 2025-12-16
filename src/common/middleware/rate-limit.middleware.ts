import type { Request, Response, NextFunction, RequestHandler } from 'express';

import { TooManyRequestsError } from '@/common/exceptions/http.exception';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}

export function rateLimitMiddleware(options: RateLimitOptions): RequestHandler {
  const store: Map<string, number[]> = new Map<string, number[]>();

  return function rateLimit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const now: number = Date.now();

    const key: string = options.keyGenerator?.(req) ?? req.ip ?? 'unknown';

    const windowStart: number = now - options.windowMs;
    const timestamps: number[] = store.get(key) ?? [];

    // Keep only timestamps inside the window
    const recent: number[] = timestamps.filter((ts) => ts > windowStart);

    recent.push(now);
    store.set(key, recent);

    // Enforce limit
    if (recent.length > options.max) {
      res.setHeader('Retry-After', String(options.windowMs / 1000));

      throw new TooManyRequestsError(
        `Too many requests — limit is ${options.max} per ${options.windowMs / 1000}s.`,
      );
    }

    next();
  };
}
