import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { AppLogger } from '@/modules/logger/services/logger.service';

/**
 * @fileoverview
 * Global HTTP logging interceptor for structured request observability.
 *
 * Captures and logs essential metadata for each handled HTTP request,
 * including:
 * - HTTP method and path
 * - Response status code
 * - Total processing duration (in milliseconds)
 *
 * Both successful and failed requests are logged using the
 * {@link AppLogger} service, ensuring a consistent format across
 * the entire application lifecycle.
 *
 * ---
 * ### Log Format
 * ```
 * [12:45:02.115] INFO: GET /items 200 → 14.23ms { context: HttpLoggingInterceptor, method: GET, path: /items, status: 200, duration: 14.23 }
 * [12:45:03.892] ERROR: POST /items 400 → 8.12ms { context: HttpLoggingInterceptor, method: POST, path: /items, status: 400, duration: 8.12 }
 * ```
 *
 * ---
 * ### Purpose
 * - Provides real-time visibility into HTTP traffic.
 * - Enables request performance tracking for diagnostics and metrics.
 * - Ensures error responses are captured in a uniform, structured manner.
 *
 * ---
 * ### Usage
 * Register globally in `main.ts`:
 * ```ts
 * import { HttpLoggingInterceptor } from '@/modules/logger/interceptors/http-logging.interceptor';
 *
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule, { bufferLogs: true });
 *   const log = app.get(AppLogger);
 *
 *   app.useLogger(log);
 *   app.useGlobalInterceptors(new HttpLoggingInterceptor(log));
 *
 *   await app.listen(3000);
 *   log.log('🚀 Server running on http://localhost:3000', { context: 'bootstrap' });
 * }
 * ```
 */
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  /**
   * Intercepts all incoming HTTP requests, measures execution time,
   * and logs structured details after the response is sent.
   *
   * For failed requests (exceptions thrown within route handlers),
   * errors are logged using {@link AppLogger.error}.
   *
   * @param context - Current NestJS execution context containing request and response.
   * @param next - CallHandler controlling the next step in the interceptor chain.
   * @returns Observable stream of the route handler result.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = performance.now();
    const http = context.switchToHttp();

    // Explicitly typed Express request/response objects
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const method = request.method;
    const path = request.originalUrl ?? request.url;

    return next.handle().pipe(
      tap({
        /**
         * Called when the request completes successfully.
         * Logs request method, path, status code, and total duration.
         */
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

        /**
         * Called when an error is thrown during request processing.
         * Logs the exception stack trace along with request metadata.
         */
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
