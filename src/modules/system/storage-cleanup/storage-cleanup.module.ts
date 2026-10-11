import { DynamicModule, Module, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { env } from '@/config/environment.config';
import { cleanupProducerConnection } from './queues/storage-cleanup.connections';
import { StorageModule } from '../storage/storage.module';
import { StorageDeletionIntentEntity } from './entities/storage-deletion-intent.entity';
import { StorageDeletionIntentRepository } from './repositories/storage-deletion-intent.repository';
import { StorageCleanupService } from './services/storage-cleanup.service';
import { StorageCleanupDispatcher } from './services/storage-cleanup-dispatcher.service';
import { StorageCleanupProcessor } from './processors/storage-cleanup.processor';
import { StorageCleanupDeadLetterProcessor } from './processors/storage-cleanup-dlq.processor';
import {
  STORAGE_CLEANUP_QUEUE,
  STORAGE_CLEANUP_DLQ,
  StorageCleanupQueue,
} from './queues/storage-cleanup.queue';
import { StorageReferenceReader } from './types/storage-reference-reader';

@Module({
  imports: [
    TypeOrmModule.forFeature([StorageDeletionIntentEntity]),
    StorageModule,
    BullModule.registerQueue(
      { name: STORAGE_CLEANUP_QUEUE, connection: cleanupProducerConnection },
      { name: STORAGE_CLEANUP_DLQ, connection: cleanupProducerConnection },
    ),
    ...(env.BULL_BOARD_ENABLED
      ? [
          BullBoardModule.forFeature(
            { name: STORAGE_CLEANUP_QUEUE, adapter: BullMQAdapter },
            { name: STORAGE_CLEANUP_DLQ, adapter: BullMQAdapter },
          ),
        ]
      : []),
  ],
  providers: [
    StorageDeletionIntentRepository,
    StorageCleanupService,
    StorageCleanupQueue,
    StorageCleanupDispatcher,
    StorageCleanupProcessor,
    StorageCleanupDeadLetterProcessor,
  ],
  exports: [StorageCleanupService],
})
export class StorageCleanupModule {
  public static register(
    referenceReader: Type<StorageReferenceReader>,
  ): DynamicModule {
    return {
      module: StorageCleanupModule,
      providers: [
        { provide: StorageReferenceReader, useClass: referenceReader },
      ],
    };
  }
}
