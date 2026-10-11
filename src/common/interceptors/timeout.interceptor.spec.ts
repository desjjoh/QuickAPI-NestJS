import { EventEmitter } from 'node:events';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, of } from 'rxjs';
import { TimeoutInterceptor } from './timeout.interceptor';
import { RequestTimeoutError } from '../exceptions/http.exception';
import { RequestTimeout } from '../decorators/request-timeout.decorator';
import { assertRequestActive } from '../helpers/request-deadline.helper';

describe('TimeoutInterceptor', () => {
  class Routes {
    @RequestTimeout(90_000)
    public upload(): void {}
  }
  let response: EventEmitter & {
    headersSent: boolean;
    writableFinished: boolean;
    destroyed: boolean;
  };
  const context = (handler: () => unknown = () => undefined) =>
    ({
      switchToHttp: () => ({ getResponse: () => response }),
      getHandler: () => handler,
      getClass: () => Routes,
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.useFakeTimers();
    response = Object.assign(new EventEmitter(), {
      headersSent: false,
      writableFinished: false,
      destroyed: false,
    });
  });
  afterEach(() => jest.useRealTimers());

  it('errors through the stream but drains underlying promises', async () => {
    let finish!: () => void;
    const finished = jest.fn();
    const error = jest.fn();
    const work = async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      finished();
      assertRequestActive();
    };
    const subscription = new TimeoutInterceptor(50)
      .intercept(context(), {
        handle: () => from(work()),
      })
      .subscribe({ error });
    await jest.advanceTimersByTimeAsync(50);
    expect(error).toHaveBeenCalledWith(expect.any(RequestTimeoutError));
    expect(subscription.closed).toBe(true);
    expect(finished).not.toHaveBeenCalled();
    finish();
    await jest.advanceTimersByTimeAsync(0);
    expect(finished).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    expect(response.listenerCount('close')).toBe(0);
  });

  it('cleans timers/listeners after success and normal failure', () => {
    new TimeoutInterceptor()
      .intercept(context(), { handle: () => of('ok') })
      .subscribe();
    expect(jest.getTimerCount()).toBe(0);
    expect(response.listenerCount('finish')).toBe(0);
    expect(response.listenerCount('close')).toBe(0);
    const error = jest.fn();
    new TimeoutInterceptor()
      .intercept(context(), {
        handle: () => {
          throw new Error('failed');
        },
      })
      .subscribe({ error });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'failed' }),
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('uses route-specific upload deadlines', async () => {
    let finish!: (value: string) => void;
    const value = jest.fn();
    const error = jest.fn();
    new TimeoutInterceptor(50, new Reflector())
      .intercept(context(Routes.prototype.upload), {
        handle: () =>
          from(
            new Promise<string>((resolve) => {
              finish = resolve;
            }),
          ),
      })
      .subscribe({ next: value, error });
    await jest.advanceTimersByTimeAsync(60_000);
    expect(error).not.toHaveBeenCalled();
    finish('uploaded');
    await jest.advanceTimersByTimeAsync(0);
    expect(value).toHaveBeenCalledWith('uploaded');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('marks disconnected work cancelled without unsubscribing it', async () => {
    let finish!: () => void;
    const error = jest.fn();
    new TimeoutInterceptor()
      .intercept(context(), {
        handle: () =>
          from(
            (async () => {
              await new Promise<void>((resolve) => {
                finish = resolve;
              });
              assertRequestActive();
            })(),
          ),
      })
      .subscribe({ error });
    response.emit('close');
    expect(jest.getTimerCount()).toBe(0);
    expect(error).not.toHaveBeenCalled();
    finish();
    await jest.advanceTimersByTimeAsync(0);
    expect(error).toHaveBeenCalledWith(expect.any(RequestTimeoutError));
  });
});
