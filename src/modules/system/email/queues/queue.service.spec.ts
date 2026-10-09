import { EmailQueueService } from './queue.service';
import { EMAIL_JOB_SEND } from './queue.tokens';

describe('EmailQueueService durable delivery', () => {
  const queue = { getJob: jest.fn(), add: jest.fn() };
  const service = new EmailQueueService(queue as never);
  beforeEach(() => jest.resetAllMocks());

  it('queues only the stable ID with bounded Redis retention', async () => {
    await service.enqueueDelivery('stable-id');
    expect(queue.add).toHaveBeenCalledWith(
      EMAIL_JOB_SEND,
      { deliveryId: 'stable-id' },
      expect.objectContaining({
        jobId: 'email-stable-id',
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 86400 },
      }),
    );
  });

  it.each(['active', 'waiting', 'delayed'])(
    'does not duplicate %s jobs',
    async (state) => {
      const retry = jest.fn();
      queue.getJob.mockResolvedValue({ getState: async () => state, retry });
      await service.enqueueDelivery('stable-id');
      expect(queue.add).not.toHaveBeenCalled();
      expect(retry).not.toHaveBeenCalled();
    },
  );

  it.each(['failed', 'completed'])(
    'retries %s jobs using their original identifier',
    async (state) => {
      const retry = jest.fn();
      queue.getJob.mockResolvedValue({ getState: async () => state, retry });
      await service.enqueueDelivery('stable-id');
      expect(retry).toHaveBeenCalledWith(state, { resetAttemptsMade: true });
      expect(queue.add).not.toHaveBeenCalled();
    },
  );
});
