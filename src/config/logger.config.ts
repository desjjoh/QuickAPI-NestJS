import moment from 'moment';
import pino, { type Logger } from 'pino';
import { gray, cyan, yellow, red, green, magenta, dim } from 'colorette';

import { env } from '@/config/environment.config';

const isDev = env.NODE_ENV !== 'production';
const defaultLevel = env.LOG_LEVEL || 'info';

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

function formatLog(level: string, msg: string): string {
  const ts: string = dim(green(formatTimestamp()));
  const lvl: string = colorLevel(level);

  return `${ts} ${lvl} ${msg}`;
}

const devStream = {
  write(raw: string) {
    try {
      const log = JSON.parse(raw);
      const msg: string = formatLog(log.levelLabel || log.level, log.msg);

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
    formatters: {
      level(label) {
        return { levelLabel: label };
      },
    },
    serializers: {
      error: pino.stdSerializers.err,
    },
  },
  isDev ? devStream : undefined,
);
