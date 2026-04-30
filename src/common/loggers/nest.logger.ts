import { Injectable, LoggerService } from '@nestjs/common';
import { logger } from '@/config/logger.config';

enum LOG_LEVEL_ORDER {
  trace,
  debug,
  info,
  warn,
  error,
  fatal,
}

const MIN_LEVEL = LOG_LEVEL_ORDER.warn;

function allowed(level: keyof typeof LOG_LEVEL_ORDER): boolean {
  return LOG_LEVEL_ORDER[level] >= MIN_LEVEL;
}

@Injectable()
export class AppLogger implements LoggerService {
  log(message: string, context?: string) {
    if (!allowed('info')) return;
    logger.info({ context }, String(message));
  }

  debug(message: string, context?: string) {
    if (!allowed('debug')) return;
    logger.debug({ context }, String(message));
  }

  verbose(message: string, context?: string) {
    if (!allowed('trace')) return;
    logger.trace({ context }, String(message));
  }

  warn(message: string, context?: string) {
    if (!allowed('warn')) return;
    logger.warn({ context }, String(message));
  }

  error(message: string, trace?: string, context?: string) {
    if (!allowed('error')) return;

    logger.error({ context, trace }, String(message));
  }
}
