import type { Response } from 'express';
import { randomUUID } from 'node:crypto';

import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { logger } from '@/config/logger.config';
import { ErrorResponseDto } from '@/common/models/exception.model';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { requestContextRef } from '@/common/store/request-context.store';
import { errorDiagnostics } from '@/common/helpers/error-diagnostics.helper';
import { PublicServiceUnavailableException } from '../exceptions/public-service-unavailable.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx: HttpArgumentsHost = host.switchToHttp();
    const response: Response = ctx.getResponse<Response>();

    let status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      if (
        status < 500 ||
        exception instanceof PublicServiceUnavailableException
      )
        message = exception.message;
      else if (status === HttpStatus.SERVICE_UNAVAILABLE)
        message = 'Service unavailable';
    }

    const requestId = requestContextRef?.get('requestId') ?? randomUUID();
    const diagnostics = { requestId, status, ...errorDiagnostics(exception) };
    if (status >= 500) logger.error(diagnostics, 'HTTP server failure.');
    else logger.warn(diagnostics, 'HTTP request rejected.');
    // Timed-out/disconnected work may fail after the HTTP response has ended.
    if (response.headersSent || response.destroyed) return;
    response.setHeader('X-Request-ID', requestId);
    response
      .status(status)
      .json(
        new ErrorResponseDto(
          status,
          message,
          status >= 500 ? requestId : undefined,
        ),
      );
  }
}
