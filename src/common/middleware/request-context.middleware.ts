import { Request, Response, NextFunction } from 'express';

import { Injectable, NestMiddleware } from '@nestjs/common';

import { RequestContext } from '@/common/store/request-context.store';
import { generateRequestId } from '@/helpers/nanoid.helper';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly store: RequestContext) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const context = {
      requestId: generateRequestId(),
      method: req.method,
      path: req.originalUrl ?? req.url,
      ip: req.ip,
    };

    this.store.run(context, next);
  }
}
