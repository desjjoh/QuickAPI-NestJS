import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageEntity } from './entities/image.entity';
import { ImageService } from './services/image.service';
import { ImageRepository } from './repositories/image.repository';
import { StorageModule } from '@/modules/system/storage/storage.module';
import { ImageProcessingModule } from '@/modules/system/image-processing/image-processing.module';
import { StorageCleanupModule } from '@/modules/system/storage-cleanup/storage-cleanup.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImageEntity]),
    StorageModule,
    ImageProcessingModule,
    StorageCleanupModule.register(ImageRepository),
  ],
  providers: [ImageService, ImageRepository],
  exports: [ImageService],
})
export class MediaModule {}
