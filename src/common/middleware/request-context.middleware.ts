import type { Request, Response, NextFunction, RequestHandler } from 'express';

import { requestContextRef } from '@/common/store/request-context.store';
import { generateRequestId } from '@/common/helpers/nanoid.helper';

export function requestContextMiddleware(): RequestHandler {
  return function requestContext(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    const userAgent = req.get('user-agent');
    const ctx = {
      requestId: generateRequestId(),
      method: req.method,
      ipAddress: req.ip,
      ...(userAgent ? { userAgent } : {}),
      actorType: 'anonymous' as const,
      source: 'http' as const,
    };

    if (!requestContextRef) return next();

    requestContextRef.run(ctx, () => {
      next();
    });
  };
}
