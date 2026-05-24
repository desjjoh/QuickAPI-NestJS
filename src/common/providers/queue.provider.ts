import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConnectionOptions, Queue, QueueEvents } from 'bullmq';

import { logger } from '@/config/logger.config';

interface QueueEventsProviderOptions {
  queueName: string;
  connection: ConnectionOptions;
  deadLetterQueueName?: string;
}

@Injectable()
export class QueueEventsProvider
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly queue: Queue;
  private readonly queueEvents: QueueEvents;
  private readonly dlq?: Queue;

  public constructor(private readonly options: QueueEventsProviderOptions) {
    const { connection, queueName, deadLetterQueueName } = this.options;

    this.queue = new Queue(queueName, { connection });
    this.queueEvents = new QueueEvents(queueName, { connection });

    if (deadLetterQueueName)
      this.dlq = new Queue(deadLetterQueueName, { connection });
  }

  async onModuleInit(): Promise<void> {
    const { deadLetterQueueName } = this.options;

    this.queueEvents.on('failed', async ({ jobId, failedReason }) => {
      logger.error(`Job ${jobId} failed: ${failedReason}`);

      const job = await this.queue.getJob(jobId);

      if (!job) return;

      const maxAttempts = job.opts.attempts ?? 1;
      const hasAttemptsRemaining = job.attemptsMade < maxAttempts;

      if (hasAttemptsRemaining) {
        logger.warn(
          `Job ${jobId} failed attempt ${job.attemptsMade}/${maxAttempts}; waiting for retry.`,
        );

        return;
      }

      if (!this.dlq || !deadLetterQueueName) return;

      const failurePayload = {
        originalData: job.data,
        meta: {
          jobId: job.id,
          attemptsMade: job.attemptsMade,
          failedReason,
          stacktrace: job.stacktrace,
          timestamp: Date.now(),
          queueName: this.queue.name,
        },
      };

      await this.dlq.add(deadLetterQueueName, failurePayload, {
        removeOnComplete: false,
        removeOnFail: false,
      });

      logger.warn(`Job ${jobId} moved to DLQ ${deadLetterQueueName}`);
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      logger.warn(`Job ${jobId} stalled.`);
    });

    await this.queueEvents.waitUntilReady();
  }

  public async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([
      this.queue.close(),
      this.queueEvents.close(),
      this.dlq?.close(),
    ]);
  }
}
