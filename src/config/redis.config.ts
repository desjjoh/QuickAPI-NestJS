import type { RedisOptions } from 'ioredis';

import { env } from './environment.config';

export const redisConnection: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  enableReadyCheck: true,
  enableOfflineQueue: true,
};
