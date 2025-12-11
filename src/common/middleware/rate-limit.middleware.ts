import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { TooManyRequestsError } from '@/common/exceptions/http.exception';

export const RATE_LIMIT_OPTIONS = Symbol('RATE_LIMIT_OPTIONS');

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly store: Map<string, number[]> = new Map<string, number[]>();

  constructor(
    @Inject(RATE_LIMIT_OPTIONS)
    private readonly options: RateLimitOptions,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const now: number = Date.now();
    const key: string = this.options.keyGenerator?.(req) ?? req.ip ?? 'unknown';

    const windowStart: number = now - this.options.windowMs;
    const timestamps: number[] = this.store.get(key) ?? [];

    const recent: number[] = timestamps.filter((ts) => ts > windowStart);

    recent.push(now);
    this.store.set(key, recent);

    if (recent.length > this.options.max) {
      res.setHeader('Retry-After', String(this.options.windowMs / 1000));

      throw new TooManyRequestsError(
        `Too many requests — limit is ${this.options.max} per ${this.options.windowMs / 1000}s.`,
      );
    }

    next();
  }
}
