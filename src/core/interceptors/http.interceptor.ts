import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { AppLogger } from '@/modules/system/logger/services/logger.service';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = performance.now();
    const http = context.switchToHttp();

    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const method = request.method;
    const path = request.originalUrl ?? request.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (performance.now() - start).toFixed(2);
          const status = response.statusCode;

          this.logger.log(`${method} ${path} ${status} → ${duration}ms`, {
            context: HttpLoggingInterceptor.name,
            method,
            path,
            status,
            duration,
          });
        },

        error: (err) => {
          const duration = (performance.now() - start).toFixed(2);
          const status = response.statusCode || 500;

          this.logger.error(
            `${method} ${path} ${status} → ${duration}ms`,
            (err as Error)?.stack,
            {
              context: HttpLoggingInterceptor.name,
              method,
              path,
              status,
              duration,
            },
          );
        },
      }),
    );
  }
}
