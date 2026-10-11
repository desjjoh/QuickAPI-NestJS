import { StorageCleanupDispatcher } from './storage-cleanup-dispatcher.service';

describe('StorageCleanupDispatcher', () => {
  afterEach(() => jest.useRealTimers());
  it('sweeps on startup, avoids overlapping sweeps, and stops on shutdown', async () => {
    jest.useFakeTimers();
    let finish!: () => void;
    const cleanup = {
      dispatch: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    };
    const dispatcher = new StorageCleanupDispatcher(cleanup as never);
    dispatcher.onModuleInit();
    jest.advanceTimersByTime(15000);
    expect(cleanup.dispatch).toHaveBeenCalledTimes(1);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    await dispatcher.onModuleDestroy();
    jest.advanceTimersByTime(15000);
    expect(cleanup.dispatch).toHaveBeenCalledTimes(1);
  });
});
