import moment from 'moment';
import pino, { type Logger } from 'pino';
import { gray, cyan, yellow, red, green, magenta, dim } from 'colorette';
import os from 'node:os';

import { env } from '@/config/environment.config';
import { log_level } from '@/library/types/env.types';
import { requestContextRef } from '@/common/store/request-context.store';

const isDev: boolean = env.NODE_ENV !== 'production';
const defaultLevel: log_level = env.LOG_LEVEL;

function formatTimestamp(): string {
  return moment().format('YYYY-MM-DD HH:mm:ss.SSS');
}

const levelColors: Record<string, (str: string) => string> = {
  trace: gray,
  debug: cyan,
  info: green,
  warn: yellow,
  error: red,
  fatal: magenta,
};

function colorLevel(level: string): string {
  const color: (str: string) => string = levelColors[level] || gray;

  return color(`[${level.padEnd(5, ' ')}]`);
}

function formatLog(
  level: string,
  msg: string,
  context: Record<string, unknown>,
): string {
  const ts: string = dim(green(formatTimestamp()));
  const lvl: string = colorLevel(level);
  const rid = context.requestId ? magenta(`[${context.requestId}]`) + ' ' : '';
  const pid = context.pid ? cyan(`[${context.pid}]`) + ' ' : '';

  const meta = { ...context };

  delete meta.msg;
  delete meta.level;
  delete meta.levelLabel;

  return `${ts} ${pid}${lvl} ${rid}${msg}`;
}

const devStream = {
  write(raw: string) {
    try {
      const log = JSON.parse(raw);
      const msg: string = formatLog(log.levelLabel || log.level, log.msg, log);

      process.stdout.write(msg + '\n');
    } catch {
      process.stdout.write(raw);
    }
  },
};

export const logger: Logger = pino(
  {
    level: defaultLevel,
    timestamp: false,
    base: {
      pid: process.pid,
      hostname: os.hostname(),
    },
    formatters: {
      level(label) {
        return { levelLabel: label };
      },
    },
    mixin() {
      const ctx = requestContextRef?.getStore();
      if (!ctx) return {};

      return {
        requestId: ctx.requestId,
        method: ctx.method,
        path: ctx.path,
        ip: ctx.ip,
      };
    },
    serializers: {
      error: pino.stdSerializers.err,
    },
  },
  isDev ? devStream : undefined,
);
