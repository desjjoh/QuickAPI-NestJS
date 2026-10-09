jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { defer, firstValueFrom } from 'rxjs';
import { SecurityTransactionInterceptor } from './security-transaction.interceptor';

describe('SecurityTransactionInterceptor', () => {
  const cookie = jest.fn();
  const clearCookie = jest.fn();
  const response = { cookie, clearCookie, setHeader: jest.fn() };
  const request = { headers: {} as Record<string, string> };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ExecutionContext;
  const transaction = jest.fn();
  const interceptor = new SecurityTransactionInterceptor({
    transaction,
  } as never);

  beforeEach(() => {
    jest.clearAllMocks();
    request.headers = {};
    response.cookie = cookie;
    response.clearCookie = clearCookie;
    transaction.mockImplementation(async (work) => work());
  });

  it('does not write or clear cookies before commit', async () => {
    transaction.mockImplementation(async (work) => {
      const result = await work();
      expect(cookie).not.toHaveBeenCalled();
      expect(clearCookie).not.toHaveBeenCalled();
      return result;
    });
    const result = await firstValueFrom(
      interceptor.intercept(context, {
        handle: () =>
          defer(async () => {
            response.cookie('refresh', 'secret');
            response.clearCookie('old-refresh');
            return { token: 'access' };
          }),
      }),
    );
    expect(result).toEqual({ token: 'access' });
    expect(cookie).toHaveBeenCalledWith('refresh', 'secret');
    expect(clearCookie).toHaveBeenCalledWith('old-refresh');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store',
    );
    expect(response.cookie).toBe(cookie);
  });

  it.each(['handler', 'commit'])(
    'discards staged cookies on %s failure',
    async (failure) => {
      const error = new Error('rollback');
      transaction.mockImplementation(async (work) => {
        await work();
        throw error;
      });
      await expect(
        firstValueFrom(
          interceptor.intercept(context, {
            handle: () =>
              defer(async () => {
                response.cookie('refresh', 'secret');
                response.clearCookie('refresh');
                if (failure === 'handler') throw error;
                return { token: 'secret' };
              }),
          }),
        ),
      ).rejects.toBe(error);
      expect(cookie).not.toHaveBeenCalled();
      expect(clearCookie).not.toHaveBeenCalled();
      expect(response.cookie).toBe(cookie);
      expect(response.clearCookie).toBe(clearCookie);
    },
  );

  it('rejects replay keys before executing credential operations', () => {
    request.headers['idempotency-key'] = 'retry';
    const handle = jest.fn();
    expect(() => interceptor.intercept(context, { handle })).toThrow(
      BadRequestException,
    );
    expect(transaction).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
  });
});
