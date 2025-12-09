import type { Request, Response } from 'express';
import { Observable } from 'rxjs';

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';

import { logger } from '@/config/logger.config';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start: number = performance.now();
    const http: HttpArgumentsHost = context.switchToHttp();

    const request: Request = http.getRequest<Request>();
    const response: Response = http.getResponse<Response>();

    const method: string = request.method;
    const path: string = request.originalUrl ?? request.url;

    function shortenPath(path: string, max = 20): string {
      return path.length > max ? path.slice(0, max - 1) + '…' : path;
    }

    response.on('finish', () => {
      const duration: string = (performance.now() - start).toFixed(2);
      const code: number = response.statusCode;

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
