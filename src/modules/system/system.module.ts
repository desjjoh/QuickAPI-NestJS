import { Module } from '@nestjs/common';

import { ApplicationModule } from './application/application.module';
import { AppConfigModule } from './configuration/config.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, ApplicationModule],
  exports: [AppConfigModule, DatabaseModule, ApplicationModule],
})
export class SystemModule {}
