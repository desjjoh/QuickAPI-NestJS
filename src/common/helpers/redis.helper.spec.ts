const connect = jest.fn<Promise<void>, []>();
const ping = jest.fn<Promise<string>, []>();
const quit = jest.fn<Promise<string>, []>();
const disconnect = jest.fn<void, []>();
const on = jest.fn();

const redisOptions: Array<{ password?: string }> = [];

jest.mock('ioredis', () => ({
  __esModule: true,
  default: class RedisMock {
    public constructor(options: { password?: string }) {
      redisOptions.push(options);
    }

    public connect = connect;
    public ping = ping;
    public quit = quit;
    public disconnect = disconnect;
    public on = on;
  },
}));

const mockEnv = {
  REDIS_HOST: 'redis',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: 'correct-password',
};

jest.mock('@/config/environment.config', () => ({ env: mockEnv }));

import { assertRedisAvailable, RedisUnavailableError } from './redis.helper';

describe('Redis startup assertion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisOptions.length = 0;
    mockEnv.REDIS_PASSWORD = 'correct-password';
    connect.mockResolvedValue(undefined);
    ping.mockResolvedValue('PONG');
    quit.mockResolvedValue('OK');
  });

  it('allows API startup when Redis accepts the configured password', async () => {
    await expect(assertRedisAvailable()).resolves.toBeUndefined();

    expect(redisOptions[0]?.password).toBe('correct-password');
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('allows API startup without authentication when the password is blank', async () => {
    mockEnv.REDIS_PASSWORD = '';

    await expect(assertRedisAvailable()).resolves.toBeUndefined();

    expect(redisOptions[0]?.password).toBeUndefined();
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('fails API startup when Redis rejects an incorrect password', async () => {
    mockEnv.REDIS_PASSWORD = 'incorrect-password';
    connect.mockRejectedValue(new Error('WRONGPASS invalid username-password'));

    await expect(assertRedisAvailable()).rejects.toThrow(RedisUnavailableError);
    await expect(assertRedisAvailable()).rejects.toThrow(/WRONGPASS/);
    expect(redisOptions[0]?.password).toBe('incorrect-password');
  });
});
