import { Module } from '@nestjs/common';

import { CloudflareStorageService } from './services/cloudflare.r2.service';
import { StorageService } from './types/storage.types';
import { StorageUploadService } from './services/storage-upload.service';
import { TemporaryUploadCleanupService } from './services/temporary-upload-cleanup.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageObjectEntity } from './entities/storage-object.entity';
import { StorageObjectRepository } from './repositories/storage-object.repository';
import { StorageObjectService } from './services/storage-object.service';

@Module({
  imports: [TypeOrmModule.forFeature([StorageObjectEntity])],
  providers: [
    StorageObjectRepository,
    StorageObjectService,
    StorageUploadService,
    TemporaryUploadCleanupService,
    {
      provide: StorageService,
      useClass: CloudflareStorageService,
    },
  ],
  exports: [StorageService, StorageUploadService, StorageObjectService],
})
export class StorageModule {}
