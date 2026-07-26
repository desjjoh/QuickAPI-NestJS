import IORedis from 'ioredis';

import { env } from '@/config/environment.config';

export class RedisUnavailableError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RedisUnavailableError';
  }
}

export async function assertRedisAvailable(): Promise<void> {
  const client = new IORedis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,

    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,

    retryStrategy: (): null => null,
  });

  client.on('error', () => undefined);

  try {
    await client.connect();
    await client.ping();
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);

    throw new RedisUnavailableError(
      [
        `Redis is unavailable at ${env.REDIS_HOST}:${env.REDIS_PORT}. Cause: ${cause}`,
      ].join(' '),
    );
  } finally {
    await client.quit().catch(() => {
      client.disconnect();
    });
  }
}

export async function checkRedisAvailable(): Promise<boolean> {
  try {
    await assertRedisAvailable();

    return true;
  } catch {
    return false;
  }
}
