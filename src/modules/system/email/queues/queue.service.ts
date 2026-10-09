import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { EmailJobPayload, EmailQueuePayload } from './jobs.types';
import { EMAIL_QUEUE, EMAIL_JOB_SEND } from './queue.tokens';

@Injectable()
export class EmailQueueService {
  public constructor(
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue<EmailQueuePayload>,
  ) {}

  public async enqueueEmail(payload: EmailJobPayload): Promise<void> {
    await this.emailQueue.add(EMAIL_JOB_SEND, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    });
  }
  public async enqueueDelivery(deliveryId: string): Promise<void> {
    const id = `email-${deliveryId}`;
    const existing = await this.emailQueue.getJob(id);
    if (existing) {
      const state = await existing.getState();
      if (state === 'failed' || state === 'completed')
        await existing.retry(state, { resetAttemptsMade: true });
      return;
    }
    await this.emailQueue.add(
      EMAIL_JOB_SEND,
      { deliveryId },
      {
        jobId: id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 86400 },
      },
    );
  }
}
