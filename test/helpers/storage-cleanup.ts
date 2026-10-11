import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StorageDeletionIntentEntity } from '@/modules/system/storage-cleanup/entities/storage-deletion-intent.entity';
import { StorageCleanupService } from '@/modules/system/storage-cleanup/services/storage-cleanup.service';

/** Application E2E suites explicitly execute committed work, without timing-dependent polling. */
export async function drainStorageCleanup(
  app: INestApplication,
): Promise<void> {
  await app.get(StorageCleanupService).reconcile();
  const intents = await app
    .get(DataSource)
    .getRepository(StorageDeletionIntentEntity)
    .findBy({ state: 'pending' });
  for (const intent of intents)
    await app.get(StorageCleanupService).deleteObject(intent.id);
}
