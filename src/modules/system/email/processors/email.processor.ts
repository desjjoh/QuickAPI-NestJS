import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Job } from 'bullmq';

import { logger } from '@/config/logger.config';

import { EmailTransportService } from '../services/email-transport.service';
import { EMAIL_QUEUE } from '../queues/queue.tokens';
import { EmailJobPayload } from '../queues/jobs.types';

@Injectable()
@Processor(EMAIL_QUEUE)
export class EmailQueueProcessor
  extends WorkerHost
  implements OnApplicationShutdown
{
  public constructor(private readonly transportSvc: EmailTransportService) {
    super();
  }

  public async process(job: Job<EmailJobPayload>): Promise<void> {
    logger.debug(`Sending email job ${job.id} to ${job.data.to}`);

    await this.transportSvc.sendCompiledEmail(job.data);
  }

  public async onApplicationShutdown(): Promise<void> {
    await this.worker.close();
  }
}
