import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
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
