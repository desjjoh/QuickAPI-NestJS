import { Injectable, LoggerService } from '@nestjs/common';
import { logger } from '@/config/logger.config';

@Injectable()
export class AppLogger implements LoggerService {
  log(message: string, context?: string) {
    logger.info({ context }, message);
  }

  warn(message: string, context?: string) {
    logger.warn({ context }, message);
  }

  error(message: string, trace?: string, context?: string) {
    logger.error({ context, trace }, message);
  }

  debug(message: string, context?: string) {
    logger.debug({ context }, message);
  }

  verbose(message: string, context?: string) {
    logger.trace({ context }, message);
  }
}
