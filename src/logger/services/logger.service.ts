import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import chalk from 'chalk';

/**
 * Represents optional metadata that can be attached to log entries.
 * Common fields include `context`, `duration`, or any contextual key/value pair.
 */
export interface LogMetadata {
  /** Logical context or source of the log message (e.g., "AppModule", "Bootstrap"). */
  context?: string;
  /** Additional arbitrary metadata to include in the log. */
  [key: string]: unknown;
}

/**
 * Application Logger — stdout/stderr based.
 *
 * Provides structured, colorized, and time-stamped log messages for
 * NestJS applications in development or small-scale deployments.
 *
 * ### Output Format
 * ```
 * [HH:mm:ss.SSS] LEVEL: message { context: Name, duration: 123ms }
 * ```
 *
 * ### Color Rules
 * - **Timestamp** → white
 * - **Level** → colored per severity
 * - **Message** → cyan
 * - **Metadata** → dim gray
 * - **Error Header** → bright red `ERROR:` with white message and dim gray trace
 *
 * This implementation writes directly to Node.js process streams:
 * - `stdout` for normal messages (`INFO`, `WARN`, `DEBUG`, `VERBOSE`)
 * - `stderr` for `ERROR` level messages
 *
 * @example
 * ```ts
 * const log = new AppLogger();
 * log.log('Server started', { context: 'Bootstrap' });
 * log.error('Failed to initialize', error.stack, { context: 'Database' });
 * ```
 */
@Injectable()
export class AppLogger implements LoggerService {
  /** Ordered list of supported NestJS log levels for comparison. */
  private readonly levelOrder: LogLevel[] = [
    'error',
    'warn',
    'log',
    'debug',
    'verbose',
  ];

  /** Numeric index of the current minimum log level. */
  private readonly currentLevelIndex: number;

  /**
   * Constructs a new logger instance using the configured `LOG_LEVEL`
   * environment variable. Defaults to `"log"`.
   */
  constructor() {
    const level = (process.env.LOG_LEVEL ?? 'log') as LogLevel;
    this.currentLevelIndex = this.levelOrder.indexOf(level);
  }

  /**
   * Determines if a message of the given severity should be logged,
   * based on the configured minimum log level.
   *
   * @param level - Log level to check.
   * @returns `true` if the message should be logged, otherwise `false`.
   */
  private shouldLog(level: LogLevel): boolean {
    return this.levelOrder.indexOf(level) <= this.currentLevelIndex;
  }

  /**
   * Generates a colorized timestamp in `[HH:mm:ss.SSS]` format.
   *
   * @returns A white-colored string representing the current time.
   */
  private timestamp(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return `[${chalk.white(`${hours}:${minutes}:${seconds}.${ms}`)}]`;
  }

  /**
   * Assigns color to a log level label.
   *
   * @param level - The uppercase log level string (e.g., `"ERROR"`, `"WARN"`).
   * @returns A colorized level label.
   */
  private colorLevel(level: string): string {
    switch (level) {
      case 'ERROR':
        return chalk.red.bold(level);
      case 'WARN':
        return chalk.yellow(level);
      case 'DEBUG':
        return chalk.magenta(level);
      case 'VERBOSE':
        return chalk.blue(level);
      default:
        return chalk.green(level);
    }
  }

  /**
   * Converts an optional metadata object into a dim gray string for display.
   *
   * @param meta - Object or string containing additional metadata.
   * @returns Formatted metadata or an empty string.
   */
  private formatMeta(meta?: LogMetadata | string): string {
    if (!meta) return '';
    if (typeof meta === 'string') return chalk.dim(` { context: ${meta} }`);
    if (Object.keys(meta).length === 0) return '';

    const pairs = Object.entries(meta)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(', ');

    return chalk.dim(` { ${pairs} }`);
  }

  /**
   * Formats stack traces for error messages.
   * - First line is displayed as:
   *   `ERROR: message`
   * - Remaining lines (stack) are dimmed.
   *
   * @param trace - The error stack trace.
   * @returns Formatted and colorized stack trace text.
   */
  private formatStack(trace?: string): string {
    if (!trace) return '';

    const lines = trace.split('\n');
    const first = lines.shift() ?? '';

    // Extract "Error: message" safely
    let errorName = 'Error';
    let message = '';
    if (first.includes(':')) {
      const [name, ...rest] = first.split(':');
      errorName = name.trim() || 'Error';
      message = rest.join(':').trim();
    } else {
      errorName = first.trim() || 'Error';
    }

    const header = `${chalk.redBright.bold(
      errorName.toUpperCase(),
    )} → ${message || 'Unknown error'}`;

    const rest = lines.map((line) => chalk.dim(line)).join('\n');

    return `\n${header}${rest ? `\n${rest}` : ''}`;
  }

  /**
   * Produces the formatted log string that will be written to the output stream.
   *
   * @param level - The log level label (e.g., `"INFO"`).
   * @param message - The message to log.
   * @param meta - Optional structured metadata.
   * @returns The fully formatted and colorized log entry string.
   */
  private format(
    level: string,
    message: string,
    meta?: LogMetadata | string,
  ): string {
    const msg = chalk.cyan(message);
    return `${this.timestamp()} ${this.colorLevel(level)}: ${msg}${this.formatMeta(meta)}`;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC LOG METHODS
  // ---------------------------------------------------------------------------

  /**
   * Logs an informational message to stdout.
   *
   * @param message - The message content.
   * @param meta - Optional metadata (e.g., context, duration).
   */
  log(message: string, meta?: LogMetadata | string): void {
    if (this.shouldLog('log')) {
      process.stdout.write(this.format('INFO', message, meta) + '\n');
    }
  }

  /**
   * Logs a warning message to stdout.
   *
   * @param message - The message content.
   * @param meta - Optional metadata.
   */
  warn(message: string, meta?: LogMetadata | string): void {
    if (this.shouldLog('warn')) {
      process.stdout.write(this.format('WARN', message, meta) + '\n');
    }
  }

  /**
   * Logs a debug message to stdout (visible when LOG_LEVEL >= "debug").
   *
   * @param message - The debug message.
   * @param meta - Optional metadata.
   */
  debug(message: string, meta?: LogMetadata | string): void {
    if (this.shouldLog('debug')) {
      process.stdout.write(this.format('DEBUG', message, meta) + '\n');
    }
  }

  /**
   * Logs a verbose message to stdout (visible when LOG_LEVEL = "verbose").
   *
   * @param message - The verbose message.
   * @param meta - Optional metadata.
   */
  verbose(message: string, meta?: LogMetadata | string): void {
    if (this.shouldLog('verbose')) {
      process.stdout.write(this.format('VERBOSE', message, meta) + '\n');
    }
  }

  /**
   * Logs an error message and stack trace to stderr.
   *
   * @param message - Short description of the error.
   * @param trace - Optional stack trace string.
   * @param meta - Optional metadata (e.g., context or operation name).
   */
  error(message: string, trace?: string, meta?: LogMetadata | string): void {
    if (this.shouldLog('error')) {
      process.stderr.write(
        this.format('ERROR', message, meta) + this.formatStack(trace) + '\n',
      );
    }
  }
}
