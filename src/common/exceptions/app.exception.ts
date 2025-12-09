import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  readonly timestamp: string;

  constructor(
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    message: string,
  ) {
    super({ message }, status);

    this.timestamp = new Date().toISOString();
  }
}
