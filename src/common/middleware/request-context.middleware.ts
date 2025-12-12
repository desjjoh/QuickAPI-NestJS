import type { Request, Response, NextFunction } from 'express';

import { requestContextRef } from '@/common/store/request-context.store';
import { generateRequestId } from '@/helpers/nanoid.helper';

export function requestContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const ctx = {
    requestId: generateRequestId(),
    method: req.method,
    path: req.originalUrl ?? req.url,
    ip: req.ip,
  };

  if (!requestContextRef) return next();

  requestContextRef.run(ctx, () => {
    next();
  });
}
