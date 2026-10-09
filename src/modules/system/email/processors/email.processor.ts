import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Optional } from '@nestjs/common';
import { Job } from 'bullmq';

import { logger } from '@/config/logger.config';

import { EmailTransportService } from '../services/email-transport.service';
import { EMAIL_QUEUE } from '../queues/queue.tokens';
import { EmailQueuePayload } from '../queues/jobs.types';
import { EmailOutboxService } from '../services/email-outbox.service';

@Injectable()
@Processor(EMAIL_QUEUE)
export class EmailQueueProcessor extends WorkerHost {
  public constructor(
    private readonly transportSvc: EmailTransportService,
    @Optional() private readonly outbox?: EmailOutboxService,
  ) {
    super();
  }

  public async process(job: Job<EmailQueuePayload>): Promise<void> {
    const payload = job?.data;
    if (payload && 'deliveryId' in payload) {
      if (
        typeof payload.deliveryId !== 'string' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
          payload.deliveryId,
        ) ||
        !this.outbox
      )
        throw new Error('Malformed email delivery job.');
      try {
        await this.outbox.deliver(payload.deliveryId);
      } catch {
        // Bull persists failure messages/stack traces in Redis and the DLQ.
        throw new Error(
          'Email delivery failed; durable intent remains pending.',
        );
      }
      return;
    }

    if (
      !payload ||
      typeof payload.to !== 'string' ||
      typeof payload.subject !== 'string' ||
      typeof payload.htmlBody !== 'string' ||
      typeof payload.messageStream !== 'string'
    )
      throw new Error('Malformed email job payload.');

    await this.transportSvc.sendCompiledEmail(payload);
  }

  @OnWorkerEvent('error')
  public onWorkerError(): void {
    logger.error('Email worker error.');
  }
}
