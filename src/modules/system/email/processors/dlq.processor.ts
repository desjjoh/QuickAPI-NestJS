import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Job } from 'bullmq';

import { logger } from '@/config/logger.config';

import { EmailDeadLetterPayload } from '../queues/jobs.types';
import { EMAIL_DLQ } from '../queues/queue.tokens';

@Injectable()
@Processor(EMAIL_DLQ)
export class EmailDeadLetterQueueProcessor
  extends WorkerHost
  implements OnApplicationShutdown
{
  public async process(job: Job<EmailDeadLetterPayload>): Promise<void> {
    logger.warn(
      `Handling email DLQ job ${job.id}; original job=${job.data.meta.jobId}; reason=${job.data.meta.failedReason}`,
    );
  }

  public async onApplicationShutdown(): Promise<void> {
    await this.worker.close();
  }
}
