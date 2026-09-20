import type { Request, Response, NextFunction, RequestHandler } from 'express';

import { requestContextRef } from '@/common/store/request-context.store';
import { generateRequestId } from '@/common/helpers/nanoid.helper';

import { AuditActorType, AuditSource } from '@/config/audit-events.config';

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
      normalizedRoute: req.path,
      ipAddress: req.ip,
      ...(userAgent ? { userAgent } : {}),
      actorType: AuditActorType.ANONYMOUS,
      source: AuditSource.HTTP,
    };

    if (!requestContextRef) return next();

    requestContextRef.run(ctx, () => {
      next();
    });
  };
}
