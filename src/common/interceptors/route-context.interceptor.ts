import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';

import { RequestContext } from '@/common/store/request-context.store';

@Injectable()
export class RouteContextInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const routePath = request.route?.path;

    if (typeof routePath === 'string')
      this.requestContext.set(
        'normalizedRoute',
        `${request.baseUrl ?? ''}${routePath}`,
      );

    return next.handle();
  }
}
