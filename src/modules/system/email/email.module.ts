import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { redisConnection } from '@/config/redis.config';

import { postmarkProvider } from './providers/email.provider';
import { EmailQueueProcessor } from './processors/email.processor';
import { EmailService } from './services/email.service';
import { EmailTransportService } from './services/email-transport.service';
import { QueueEventsProvider } from '@/common/providers/queue.provider';
import { EmailDeadLetterQueueProcessor } from './processors/dlq.processor';
import { EmailQueueService } from './queues/queue.service';
import { EMAIL_QUEUE, EMAIL_DLQ } from './queues/queue.tokens';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRoot({
      connection: redisConnection,
    }),
    BullModule.registerQueue(
      {
        name: EMAIL_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: false,
          removeOnFail: false,
        },
      },
      {
        name: EMAIL_DLQ,
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: false,
          removeOnFail: false,
        },
      },
    ),
  ],
  providers: [
    postmarkProvider,

    EmailService,
    EmailTransportService,
    EmailQueueService,

    EmailQueueProcessor,
    EmailDeadLetterQueueProcessor,

    {
      provide: QueueEventsProvider,
      useFactory: () =>
        new QueueEventsProvider({
          queueName: EMAIL_QUEUE,
          connection: redisConnection,
          deadLetterQueueName: EMAIL_DLQ,
        }),
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
