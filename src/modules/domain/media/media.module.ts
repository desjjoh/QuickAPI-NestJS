import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ImageEntity } from './entities/image.entity';

import { ImageService } from './services/image.service';
import { ImageRepository } from './repositories/image.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ImageEntity])],
  providers: [ImageService, ImageRepository],
  exports: [ImageService],
})
export class MediaModule {}
