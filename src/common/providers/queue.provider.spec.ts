const queueInstances: MockQueue[] = [];
const eventInstances: MockQueueEvents[] = [];
class MockQueue {
  public name: string;
  public on = jest.fn();
  public add = jest.fn().mockResolvedValue(undefined);
  public getJob = jest.fn();
  public close = jest.fn().mockResolvedValue(undefined);
  constructor(name: string) {
    this.name = name;
    queueInstances.push(this);
  }
}
class MockQueueEvents {
  public handlers = new Map<string, (...args: unknown[]) => unknown>();
  public on = jest.fn(
    (event: string, handler: (...args: unknown[]) => unknown) => {
      this.handlers.set(event, handler);
    },
  );
  public waitUntilReady = jest.fn().mockResolvedValue(undefined);
  public close = jest.fn().mockResolvedValue(undefined);
  constructor() {
    eventInstances.push(this);
  }
}
jest.mock('bullmq', () => ({ Queue: MockQueue, QueueEvents: MockQueueEvents }));

import { QueueEventsProvider } from './queue.provider';

describe('QueueEventsProvider email retry and DLQ routing', () => {
  beforeEach(() => {
    queueInstances.length = 0;
    eventInstances.length = 0;
  });
  it('waits while attempts remain, then routes the terminal failure to the DLQ', async () => {
    const provider = new QueueEventsProvider({
      queueName: 'email-queue',
      connection: {},
      deadLetterQueueName: 'email-dlq',
    });
    await provider.onModuleInit();
    const source = queueInstances[0];
    const dlq = queueInstances[1];
    const failed = eventInstances[0].handlers.get('failed')!;
    source.getJob.mockResolvedValueOnce({
      id: '7',
      data: { to: 'u@example.com' },
      opts: { attempts: 3 },
      attemptsMade: 2,
      stacktrace: ['temporary'],
    });
    await failed({ jobId: '7', failedReason: 'temporary' });
    expect(dlq.add).not.toHaveBeenCalled();
    source.getJob.mockResolvedValueOnce({
      id: '7',
      data: { to: 'u@example.com' },
      opts: { attempts: 3 },
      attemptsMade: 3,
      stacktrace: ['terminal'],
    });
    await failed({ jobId: '7', failedReason: 'terminal' });
    expect(dlq.add).toHaveBeenCalledWith(
      'email-dlq',
      expect.objectContaining({
        originalData: { to: 'u@example.com' },
        meta: expect.objectContaining({
          jobId: '7',
          attemptsMade: 3,
          failedReason: 'terminal',
          queueName: 'email-queue',
        }),
      }),
      { removeOnComplete: false, removeOnFail: false },
    );
  });
  it('ignores failed events whose job no longer exists and closes clients safely', async () => {
    const provider = new QueueEventsProvider({
      queueName: 'email-queue',
      connection: {},
      deadLetterQueueName: 'email-dlq',
    });
    await provider.onModuleInit();
    queueInstances[0].getJob.mockResolvedValue(undefined);
    await eventInstances[0].handlers.get('failed')!({
      jobId: 'missing',
      failedReason: 'gone',
    });
    expect(queueInstances[1].add).not.toHaveBeenCalled();
    await provider.onApplicationShutdown();
    expect(
      queueInstances.every((queue) => queue.close.mock.calls.length === 1),
    ).toBe(true);
    expect(eventInstances[0].close).toHaveBeenCalled();
  });
});
