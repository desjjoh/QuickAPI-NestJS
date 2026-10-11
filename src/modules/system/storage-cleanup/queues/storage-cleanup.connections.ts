import type { RedisOptions } from 'ioredis';
import { redisConnection } from '@/config/redis.config';

// Producers fail quickly; unfinished dispatch remains recoverable in SQL.
export const cleanupProducerConnection: RedisOptions = {
  ...redisConnection,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 5000,
};

// Workers use persistent blocking connections, never producer retry limits.
export const cleanupWorkerConnection: RedisOptions = {
  ...redisConnection,
  enableOfflineQueue: true,
  maxRetriesPerRequest: null,
};
