import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * @fileoverview
 * Defines the base application-level exception used throughout the API.
 *
 * {@link AppException} extends NestJS’s {@link HttpException} to provide
 * a unified, type-safe, and structured error format that can be used
 * across controllers, services, and domain logic.
 *
 * ---
 * ### Purpose
 * - Enforces a **consistent error shape** across the entire application.
 * - Integrates seamlessly with the {@link GlobalExceptionFilter}.
 * - Provides optional **domain-specific error codes** for use in clients or logs.
 *
 * ---
 * ### Default Behavior
 * - If no {@link HttpStatus} is provided, defaults to `500 Internal Server Error`.
 * - Error responses include both a `message` and an optional `code` field.
 * - Supports clean JSON serialization in HTTP responses.
 *
 * ---
 * ### Example Error Response
 * ```json
 * {
 *   "statusCode": 404,
 *   "message": "User not found",
 *   "code": "USER_NOT_FOUND"
 * }
 * ```
 *
 * ---
 * ### Example Usage
 * ```ts
 * import { AppException } from '@/modules/errors/app.exception';
 * import { HttpStatus } from '@nestjs/common';
 *
 * throw new AppException('User not found', HttpStatus.NOT_FOUND, 'USER_NOT_FOUND');
 * ```
 */
export class AppException extends HttpException {
  /**
   * Optional application-specific error code used to identify
   * logical error conditions in a more granular way than HTTP status codes.
   *
   * Example values:
   * - `"USER_NOT_FOUND"`
   * - `"INVALID_TOKEN"`
   * - `"DATABASE_TIMEOUT"`
   */
  readonly code?: string;

  /**
   * Constructs a new {@link AppException} instance.
   *
   * @param message - Human-readable error message describing the failure.
   * @param status - HTTP status to return (default: `500 Internal Server Error`).
   * @param code - Optional domain-specific error code for diagnostics.
   *
   * @example
   * throw new AppException('Invalid credentials', HttpStatus.UNAUTHORIZED, 'AUTH_INVALID');
   */
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    code?: string,
  ) {
    super({ message, code }, status);
    this.code = code;
  }
}
