import type { Request, Response } from 'express';
import { Observable } from 'rxjs';

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';

import { logger } from '@/config/logger.config';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = performance.now();
    const http = context.switchToHttp();

    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const method = request.method;
    const path = request.originalUrl ?? request.url;

    function shortenPath(path: string, max = 20): string {
      return path.length > max ? path.slice(0, max - 1) + '…' : path;
    }

    response.on('finish', () => {
      const duration = (performance.now() - start).toFixed(2);
      const code = response.statusCode;

      const level: 'error' | 'warn' | 'debug' =
        code >= 500 ? 'error' : code >= 400 ? 'warn' : 'debug';

      const pathPadded: string = shortenPath(path, 30).padEnd(32);
      const status: string = String(code).padEnd(3, ' ');
      const methodPadded: string = method.padEnd(7, ' ');

      logger[level](`${status} ${methodPadded} ${pathPadded} ${duration}ms`);
    });

    return next.handle();
  }
}
