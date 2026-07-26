import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';

import { logger } from '@/config/logger.config';

import { EmailDeadLetterPayload } from '../queues/jobs.types';
import { EMAIL_DLQ } from '../queues/queue.tokens';

@Injectable()
@Processor(EMAIL_DLQ)
export class EmailDeadLetterQueueProcessor extends WorkerHost {
  public async process(job: Job<EmailDeadLetterPayload>): Promise<void> {
    if (
      !job?.data?.meta ||
      typeof job.data.meta.failedReason !== 'string' ||
      !Array.isArray(job.data.meta.stacktrace)
    )
      throw new Error('Malformed email dead-letter job payload.');

    logger.info(
      `Handling email DLQ job ${job.id}; original job=${job.data.meta.jobId}; reason=${job.data.meta.failedReason}`,
    );
  }

  @OnWorkerEvent('error')
  public onWorkerError(error: Error): void {
    logger.error(error.message);
  }
}
