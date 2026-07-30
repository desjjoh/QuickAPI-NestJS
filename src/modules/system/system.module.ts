import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module';
import { TokenModule } from './tokens/token.module';
import { GeolocationModule } from './geolocation/geolocation.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [DatabaseModule, TokenModule, GeolocationModule, AuditModule],
  exports: [DatabaseModule, TokenModule, GeolocationModule, AuditModule],
})
export class SystemModule {}
