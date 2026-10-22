import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module';
import { TokenModule } from './tokens/token.module';
import { GeolocationModule } from './geolocation/geolocation.module';
import { ImageProcessingModule } from './image-processing/image-processing.module';

@Module({
  imports: [
    DatabaseModule,
    TokenModule,
    GeolocationModule,
    ImageProcessingModule,
  ],
  exports: [
    DatabaseModule,
    TokenModule,
    GeolocationModule,
    ImageProcessingModule,
  ],
})
export class SystemModule {}
