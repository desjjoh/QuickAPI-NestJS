import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module';
import { TokenModule } from './tokens/token.module';
import { GeolocationModule } from './geolocation/geolocation.module';

@Module({
  imports: [DatabaseModule, TokenModule, GeolocationModule],
  exports: [DatabaseModule, TokenModule, GeolocationModule],
})
export class SystemModule {}
