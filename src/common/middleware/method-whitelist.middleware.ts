import { Injectable, Inject, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { MethodNotAllowedError } from '@/common/exceptions/http.exception';

export const METHOD_WHITELIST_TOKEN = Symbol('METHOD_WHITELIST_TOKEN');

export interface MethodWhitelistOptions {
  allowedMethods: string[];
}

const ALWAYS_ALLOWED: Set<string> = new Set(['HEAD', 'OPTIONS']);

@Injectable()
export class MethodWhitelistMiddleware implements NestMiddleware {
  private readonly allowed: Set<string>;

  constructor(
    @Inject(METHOD_WHITELIST_TOKEN)
    private readonly opts: MethodWhitelistOptions,
  ) {
    this.allowed = new Set(
      this.opts.allowedMethods.map((m) => m.toUpperCase()),
    );
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    const method: string = req.method.toUpperCase();
    const allowedList = this.allowed
      ? Array.from(this.allowed).join(', ')
      : null;

    if (!this.allowed.has(method) && !ALWAYS_ALLOWED.has(method)) {
      throw new MethodNotAllowedError(
        `HTTP method '${method}' is not allowed. Allowed methods: ${allowedList}.`,
      );
    }

    next();
  }
}
