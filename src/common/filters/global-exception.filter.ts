import { Response } from 'express';

import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { logger } from '@/config/logger.config';
import { ErrorResponseDto } from '@/library/models/exception.model';

@Catch(HttpException, Error)
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException | Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    } else if (exception instanceof Error) {
      logger.error(message);
    }

    const errorResponse = new ErrorResponseDto(status, message);
    response.status(status).json(errorResponse);
  }
}
