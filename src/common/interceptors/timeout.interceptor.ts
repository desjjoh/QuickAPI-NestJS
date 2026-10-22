import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { RequestDeadline } from '../helpers/request-deadline.helper';
import { REQUEST_TIMEOUT_MS } from '../decorators/request-timeout.decorator';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(
    private readonly ms: number = 5_000,
    private readonly reflector = new Reflector(),
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http: HttpArgumentsHost = context.switchToHttp();
    const res = http.getResponse<Response>();
    const ms =
      this.reflector.getAllAndOverride<number>(REQUEST_TIMEOUT_MS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? this.ms;

    return new Observable((observer) => {
      const deadline = new RequestDeadline(Date.now() + ms);
      const cleanup = () => {
        clearTimeout(timer);
        res.off('finish', cleanup);
        res.off('close', disconnected);
      };

      const disconnected = () => {
        if (!res.writableFinished)
          deadline.expire('Client disconnected before request completion.');
        cleanup();
      };

      const timer = setTimeout(() => {
        const error = deadline.expire(`Request timed out after ${ms}ms`);

        // Error through Nest, never an uncaught timer throw. Once headers are
        // sent, the response cannot be replaced with a JSON timeout.
        if (!res.headersSent && !res.destroyed) observer.error(error);
        cleanup();
      }, ms);

      res.once('finish', cleanup);
      res.once('close', disconnected);

      // Deliberately do not attach this subscription to the HTTP subscription.
      // A response timeout/unsubscribe must NOT cancel transaction observables
      // while their promises are still using locks, connections or temp files.
      // Drain success and failure; shared transactions check the deadline before
      // commit and run compensation only after outstanding work has settled.
      deadline.run(() => {
        try {
          next.handle().subscribe({
            next: (value) => {
              try {
                deadline.assertActive();
                observer.next(value);
              } catch (error) {
                observer.error(error);
              }
            },
            error: (error: unknown) => {
              cleanup();
              observer.error(error);
            },
            complete: () => {
              cleanup();
              observer.complete();
            },
          });
        } catch (error) {
          cleanup();
          observer.error(error);
        }
      });

      return cleanup;
    });
  }
}
