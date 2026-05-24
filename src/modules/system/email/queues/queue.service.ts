import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { EmailJobPayload } from './jobs.types';
import { EMAIL_QUEUE, EMAIL_JOB_SEND } from './queue.tokens';

@Injectable()
export class EmailQueueService {
  public constructor(
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue<EmailJobPayload>,
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
}
