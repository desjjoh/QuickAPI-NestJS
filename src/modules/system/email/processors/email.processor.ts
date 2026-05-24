import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';

import { logger } from '@/config/logger.config';

import { EmailTransportService } from '../services/email-transport.service';
import { EMAIL_QUEUE } from '../queues/queue.tokens';
import { EmailJobPayload } from '../queues/jobs.types';

@Injectable()
@Processor(EMAIL_QUEUE)
export class EmailQueueProcessor extends WorkerHost {
  public constructor(private readonly transportSvc: EmailTransportService) {
    super();
  }

  public async process(job: Job<EmailJobPayload>): Promise<void> {
    await this.transportSvc.sendCompiledEmail(job.data);
  }

  @OnWorkerEvent('error')
  public onWorkerError(error: Error): void {
    logger.error(error.message);
  }
}
