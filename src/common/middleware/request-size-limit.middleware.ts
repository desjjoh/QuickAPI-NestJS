import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

import { RequestBodyTooLargeError } from '@/common/exceptions/http.exception';

export const BODY_LIMIT_OPTIONS = Symbol('BODY_LIMIT_OPTIONS');

export interface BodyLimitOptions {
  defaultLimit: number;
  routeOverrides?: Array<[string, number]>;
}

@Injectable()
export class BodyLimitMiddleware implements NestMiddleware {
  private readonly defaultLimit: number;
  private readonly routeOverrides: Array<[string, number]>;

  constructor(
    @Inject(BODY_LIMIT_OPTIONS)
    private readonly opts: BodyLimitOptions,
  ) {
    this.defaultLimit = this.opts.defaultLimit;
    this.routeOverrides = this.opts.routeOverrides ?? [];
  }

  private selectLimit(path: string): number {
    for (const [prefix, limit] of this.routeOverrides) {
      if (path.startsWith(prefix)) return limit;
    }

    return this.defaultLimit;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const limit: number = this.selectLimit(req.path);
    let total: number = 0;
    const chunks: Buffer[] = [];
    let limitExceeded: boolean = false;

    req.on('data', (chunk: Buffer) => {
      if (limitExceeded || res.headersSent) return;

      total += chunk.length;

      if (total > limit) {
        limitExceeded = true;

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

    req.on('end', () => {
      if (limitExceeded || res.headersSent) return;

      const remaining = Math.max(limit - total, 0);

      res.setHeader('X-Body-Limit-Bytes', String(limit));
      res.setHeader('X-Body-Remaining-Bytes', String(remaining));
    });

    next();
  }
}
