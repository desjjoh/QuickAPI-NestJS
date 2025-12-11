import { Injectable, Inject, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

import { ForbiddenError } from '@/common/exceptions/http.exception';

export const CORS_OPTIONS = Symbol('CORS_OPTIONS');

export interface CorsOptions {
  origin: string | string[];
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials?: boolean;
  maxAge?: number;
}

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  constructor(
    @Inject(CORS_OPTIONS)
    private readonly opts: CorsOptions,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin ?? null;

    // Determine whether origin is allowed
    const allowed = this.isAllowedOrigin(origin);

    if (!allowed) {
      throw new ForbiddenError(`CORS origin '${origin}' not allowed.`);
    }

    // Set CORS headers
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (this.opts.origin === '*' || this.opts.origin.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', this.opts.methods.join(', '));
    res.setHeader(
      'Access-Control-Allow-Headers',
      this.opts.allowedHeaders.join(', '),
    );

    res.setHeader(
      'Access-Control-Expose-Headers',
      this.opts.exposedHeaders.join(', '),
    );

    res.setHeader('Access-Control-Max-Age', String(this.opts.maxAge));

    if (this.opts.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Preflight handling
    if (req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }

    next();
  }

  private isAllowedOrigin(origin: string | null): boolean {
    const opts = this.opts.origin;

    if (!origin) return true;

    if (opts === '*' || (Array.isArray(opts) && opts.includes('*'))) {
      return true;
    }

    if (Array.isArray(opts)) {
      return opts.includes(origin);
    }

    return opts === origin;
  }
}
