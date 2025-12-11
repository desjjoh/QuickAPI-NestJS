import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  readonly timestamp: number;

  constructor(
    status: number = HttpStatus.INTERNAL_SERVER_ERROR,
    message: string,
  ) {
    super({ message }, status);

    this.timestamp = Date.now();
  }
}
