import type { Request, Response, NextFunction } from 'express';

import { MethodNotAllowedError } from '@/common/exceptions/http.exception';

export interface MethodWhitelistOptions {
  allowedMethods: string[];
}

// Methods that are always permitted regardless of configuration
const ALWAYS_ALLOWED: Set<string> = new Set(['HEAD', 'OPTIONS']);

export function methodWhitelistMiddleware(opts: MethodWhitelistOptions) {
  // Normalize allowed methods once at construction time
  const allowed: Set<string> = new Set(
    opts.allowedMethods.map((m) => m.toUpperCase()),
  );

  return function (req: Request, _res: Response, next: NextFunction): void {
    const method: string = req.method.toUpperCase();

    // Pre-format allowed list for error messaging
    const allowedList: string | null =
      allowed.size > 0 ? Array.from(allowed).join(', ') : null;

    // Reject methods not explicitly allowed or always permitted
    if (!allowed.has(method) && !ALWAYS_ALLOWED.has(method)) {
      throw new MethodNotAllowedError(
        `HTTP method '${method}' is not allowed. Allowed methods: ${allowedList}.`,
      );
    }

    next();
  };
}
