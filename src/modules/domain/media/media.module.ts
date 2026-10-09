import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ImageEntity } from './entities/image.entity';

import { ImageService } from './services/image.service';
import { ImageRepository } from './repositories/image.repository';
import { TemporaryUploadCleanupService } from './services/temporary-upload-cleanup.service';
import { StorageModule } from '@/modules/system/storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([ImageEntity]), StorageModule],
  providers: [ImageService, ImageRepository, TemporaryUploadCleanupService],
  exports: [ImageService],
})
export class MediaModule {}
