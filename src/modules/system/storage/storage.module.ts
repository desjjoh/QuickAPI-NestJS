import { Module } from '@nestjs/common';

import { CloudflareStorageService } from './services/cloudflare.r2.service';
import { StorageService } from './types/storage.types';

@Module({
  providers: [
    {
      provide: StorageService,
      useClass: CloudflareStorageService,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
