import { Module } from '@nestjs/common';
import { ImageProcessingService } from './services/image-processing.service';

@Module({
  providers: [ImageProcessingService],
  exports: [ImageProcessingService],
})
export class ImageProcessingModule {}
