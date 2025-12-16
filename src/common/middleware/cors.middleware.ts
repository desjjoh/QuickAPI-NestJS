import type { Request, Response, NextFunction, RequestHandler } from 'express';

import { ForbiddenError } from '@/common/exceptions/http.exception';

export interface CorsOptions {
  origin: string | string[];
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials?: boolean;
  maxAge?: number;
}

export function corsMiddleware(opts: CorsOptions): RequestHandler {
  function isAllowedOrigin(origin: string | null): boolean {
    const allowed = opts.origin;

    if (!origin) return true;

    if (allowed === '*' || (Array.isArray(allowed) && allowed.includes('*'))) {
      return true;
    }

    if (Array.isArray(allowed)) {
      return allowed.includes(origin);
    }

    return allowed === origin;
  }

  return function cors(req: Request, res: Response, next: NextFunction): void {
    const origin = (req.headers.origin as string | undefined) ?? null;

    // --- Validate origin
    if (!isAllowedOrigin(origin)) {
      throw new ForbiddenError(`CORS origin '${origin}' not allowed.`);
    }

    // --- Set CORS headers
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (
      opts.origin === '*' ||
      (Array.isArray(opts.origin) && opts.origin.includes('*'))
    ) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', opts.methods.join(', '));
    res.setHeader(
      'Access-Control-Allow-Headers',
      opts.allowedHeaders.join(', '),
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      opts.exposedHeaders.join(', '),
    );

    if (opts.maxAge !== undefined) {
      res.setHeader('Access-Control-Max-Age', String(opts.maxAge));
    }

    if (opts.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // --- Preflight handling
    if (req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }

    next();
  };
}
