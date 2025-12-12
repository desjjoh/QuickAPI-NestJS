import type { Request, Response } from 'express';

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  NotFoundException,
} from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';

import { ErrorResponseDto } from '@/library/models/exception.model';
import { logger } from '@/config/logger.config';

@Catch(NotFoundException)
export class NotFoundFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx: HttpArgumentsHost = host.switchToHttp();

    const response: Response = ctx.getResponse();
    const request: Request = ctx.getRequest<Request>();

    const message: string = `Route not found — No route matches ${request.method} ${request.originalUrl}.`;

    logger.error(message);
    response.status(404).json(new ErrorResponseDto(404, message));
  }
}
