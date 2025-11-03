import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base application exception.
 *
 * Provides a consistent, typed structure for throwing errors across the app.
 * This improves maintainability and ensures predictable error formatting in logs
 * and HTTP responses.
 *
 * @example
 * throw new AppException('User not found', HttpStatus.NOT_FOUND, 'USER_NOT_FOUND');
 */
export class AppException extends HttpException {
  /** Optional application-specific error code */
  readonly code?: string;

  constructor(
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    code?: string,
  ) {
    super({ message, code }, status);
    this.code = code;
  }
}
