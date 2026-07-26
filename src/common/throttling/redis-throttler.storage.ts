import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import IORedis from 'ioredis';
import type { RedisOptions } from 'ioredis';

import { redisConnection } from '@/config/redis.config';

const INCREMENT_SCRIPT = `
local counter = KEYS[1]
local blocked = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blocked)
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', counter) or limit + 1)
  local counterTtl = redis.call('PTTL', counter)
  return {hits, math.max(counterTtl, 0), 1, blockTtl}
end

local hits = redis.call('INCR', counter)
if hits == 1 then
  redis.call('PEXPIRE', counter, ttl)
end

local counterTtl = redis.call('PTTL', counter)
if hits > limit then
  redis.call('SET', blocked, '1', 'PX', blockDuration)
  return {hits, math.max(counterTtl, 0), 1, blockDuration}
end

return {hits, math.max(counterTtl, 0), 0, 0}
`;

@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  private readonly redis: IORedis;

  public constructor(
    options: RedisOptions = redisConnection,
    private readonly namespace = 'quickapi:throttle',
  ) {
    this.redis = new IORedis({ ...options, lazyConnect: true });
  }

  public async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const namespace = `${this.namespace}:${throttlerName}:${key}`;
    const result = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      namespace,
      `${namespace}:blocked`,
      ttl,
      limit,
      blockDuration,
    )) as [number, number, number, number];

    return {
      totalHits: Number(result[0]),
      timeToExpire: Math.ceil(Number(result[1]) / 1000),
      isBlocked: Number(result[2]) === 1,
      timeToBlockExpire: Math.ceil(Number(result[3]) / 1000),
    };
  }

  public onApplicationShutdown(): void {
    this.redis.disconnect();
  }
}
