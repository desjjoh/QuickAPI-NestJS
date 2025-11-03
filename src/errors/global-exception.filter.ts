import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLogger } from '@/logger/services/logger.service';
import os from 'os';

/**
 * Global Exception Filter
 *
 * Provides a unified error-handling mechanism for all unhandled exceptions
 * across the application. This filter ensures that runtime errors, validation
 * failures, and unexpected conditions are logged in a structured, consistent
 * format and that clients receive a standardized JSON response.
 *
 * ---
 * ### Responsibilities
 * - Captures both {@link HttpException} and native {@link Error} instances.
 * - Logs all exceptions using the centralized {@link AppLogger}.
 * - Prevents internal stack traces and implementation details from leaking to clients.
 * - Provides consistent JSON structure for HTTP responses.
 *
 * ---
 * ### Behavior
 * For known framework exceptions (e.g., `BadRequestException`, `UnauthorizedException`):
 * - The HTTP status and message are derived from the `HttpException` instance.
 *
 * For unknown or runtime errors:
 * - The status defaults to `500 Internal Server Error`.
 * - A generic message (`"Internal server error"`) is returned to the client.
 * - Full error stack is still logged internally.
 *
 * ---
 * ### Example Log Output
 * ```
 * [00:41:23.511] ERROR: User not found
 * { context: GlobalExceptionFilter, env: development, pid: 2941, hostname: api-dev, status: 404 }
 * ```
 *
 * ### Example HTTP Response
 * ```json
 * {
 *   "statusCode": 404,
 *   "timestamp": "2025-11-03T00:41:23.511Z",
 *   "path": "/users/123",
 *   "message": "User not found"
 * }
 * ```
 *
 * ---
 * ### Integration
 * Registered globally in `main.ts`:
 * ```ts
 * import { GlobalExceptionFilter } from '@/errors/global-exception.filter';
 *
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule, { bufferLogs: true });
 *   const logger = app.get(AppLogger);
 *   app.useLogger(logger);
 *   app.useGlobalFilters(new GlobalExceptionFilter(logger));
 *   await app.listen(3000);
 * }
 * ```
 *
 * ---
 * ### Design Notes
 * - Keeps log formatting consistent with `AppLogger` across all layers.
 * - Includes minimal runtime metadata (environment, PID, hostname, status).
 * - Prioritizes safety and clarity over verbosity.
 * - Compatible with JSON log streaming and CI/CD log parsing pipelines.
 */
@Catch(HttpException, Error)
export class GlobalExceptionFilter implements ExceptionFilter {
  /**
   * Constructs a global exception filter.
   *
   * @param logger - Application logger instance for structured error output.
   */
  constructor(private readonly logger: AppLogger) {}

  /**
   * Core exception handling method.
   *
   * @param exception - The caught exception (either an HttpException or a generic Error).
   * @param host - The active execution context, providing access to HTTP request and response objects.
   */
  catch(exception: HttpException | Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    // Identify the error type and extract details
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    } else {
      message = String(exception);
    }

    // Prepare structured log metadata
    const metadata = {
      context: 'GlobalExceptionFilter',
      env: process.env.NODE_ENV,
      pid: process.pid,
      hostname: os.hostname(),
      status,
    };

    // Log structured error (colorized and contextualized by AppLogger)
    this.logger.error(message, exception.stack, metadata);

    // Return safe, consistent JSON response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
