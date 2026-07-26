import { Job } from 'bullmq';
import { EmailDeadLetterPayload } from '../queues/jobs.types';
import { EmailDeadLetterQueueProcessor } from './dlq.processor';

describe('EmailDeadLetterQueueProcessor', () => {
  it('accepts a complete dead-letter envelope', async () => {
    const data: EmailDeadLetterPayload = {
      originalData: {
        to: 'u@example.com',
        subject: 'Hi',
        htmlBody: 'x',
        messageStream: 'outbound',
      },
      meta: {
        jobId: '1',
        attemptsMade: 3,
        failedReason: 'failed',
        stacktrace: [],
        timestamp: 1,
        queueName: 'email-queue',
      },
    };

    await expect(
      new EmailDeadLetterQueueProcessor().process({
        id: 'dlq-1',
        data,
      } as Job<EmailDeadLetterPayload>),
    ).resolves.toBeUndefined();
  });

  it('rejects malformed dead-letter jobs', async () => {
    await expect(
      new EmailDeadLetterQueueProcessor().process({ data: {} } as Job),
    ).rejects.toThrow('Malformed email dead-letter job payload.');
  });
});
