import { EmailOutboxDispatcher } from './email-outbox-dispatcher.service';

describe('EmailOutboxDispatcher', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does not overlap sweeps and stops polling on shutdown', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const dispatch = jest.fn().mockReturnValue(pending);
    const dispatcher = new EmailOutboxDispatcher({ dispatch } as never);
    dispatcher.onModuleInit();
    await jest.advanceTimersByTimeAsync(15_000);
    expect(dispatch).toHaveBeenCalledTimes(1);
    finish();
    await jest.advanceTimersByTimeAsync(5_000);
    expect(dispatch).toHaveBeenCalledTimes(2);
    await dispatcher.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('recovers from failed sweeps on the next poll', async () => {
    const dispatch = jest
      .fn()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValue(undefined);
    const dispatcher = new EmailOutboxDispatcher({ dispatch } as never);
    dispatcher.onModuleInit();
    await jest.advanceTimersByTimeAsync(5_000);
    expect(dispatch).toHaveBeenCalledTimes(2);
    await dispatcher.onModuleDestroy();
  });
});
