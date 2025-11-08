import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import chalk from 'chalk';

export interface LogMetadata {
  context?: string;
  [key: string]: unknown;
}

@Injectable()
export class AppLogger implements LoggerService {
  private readonly levelOrder: LogLevel[] = [
    'error',
    'warn',
    'log',
    'debug',
    'verbose',
  ];

  private readonly currentLevelIndex: number;

  constructor() {
    const level = (process.env.LOG_LEVEL ?? 'log') as LogLevel;
    this.currentLevelIndex = this.levelOrder.indexOf(level);
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelOrder.indexOf(level) <= this.currentLevelIndex;
  }

  private timestamp(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return `[${chalk.white(`${hours}:${minutes}:${seconds}.${ms}`)}]`;
  }

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

  private formatMeta(meta?: LogMetadata | string): string {
    if (!meta) return '';
    if (typeof meta === 'string') return chalk.dim(` { context: ${meta} }`);
    if (Object.keys(meta).length === 0) return '';

    const pairs = Object.entries(meta)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(', ');

    return chalk.dim(` { ${pairs} }`);
  }

  private formatStack(trace?: string): string {
    if (!trace) return '';

    const lines = trace.split('\n');
    const first = lines.shift() ?? '';

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

  private format(
    level: string,
    message: string,
    meta?: LogMetadata | string,
  ): string {
    const msg = chalk.cyan(message);
    return `${this.timestamp()} ${this.colorLevel(level)}: ${msg}${this.formatMeta(meta)}`;
  }

  log(message: string, meta?: LogMetadata | string): void {
    if (this.shouldLog('log')) {
      process.stdout.write(this.format('INFO', message, meta) + '\n');
    }
  }

  warn(message: string, meta?: LogMetadata | string): void {
    if (this.shouldLog('warn')) {
      process.stdout.write(this.format('WARN', message, meta) + '\n');
    }
  }

  debug(message: string, meta?: LogMetadata | string): void {
    if (this.shouldLog('debug')) {
      process.stdout.write(this.format('DEBUG', message, meta) + '\n');
    }
  }

  verbose(message: string, meta?: LogMetadata | string): void {
    if (this.shouldLog('verbose')) {
      process.stdout.write(this.format('VERBOSE', message, meta) + '\n');
    }
  }

  error(message: string, trace?: string, meta?: LogMetadata | string): void {
    if (this.shouldLog('error')) {
      process.stderr.write(
        this.format('ERROR', message, meta) + this.formatStack(trace) + '\n',
      );
    }
  }
}
