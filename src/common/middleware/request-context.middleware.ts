import type { Request, Response, NextFunction, RequestHandler } from 'express';

import { requestContextRef } from '@/common/store/request-context.store';
import { generateRequestId } from '@/common/helpers/nanoid.helper';

type context = {
  requestId: string;
  method: string;
  path: string;
  ip: string | undefined;
};

export function requestContextMiddleware(): RequestHandler {
  return function requestContext(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    const ctx: context = {
      requestId: generateRequestId(),
      method: req.method,
      path: req.originalUrl ?? req.url,
      ip: req.ip,
    };

    if (!requestContextRef) return next();

    requestContextRef.run(ctx, () => {
      next();
    });
  };
}
