import { Module } from '@nestjs/common';

import { ApplicationModule } from './application/application.module';
import { AppConfigModule } from './configuration/config.module';
import { DatabaseModule } from './database/database.module';
import { TokenModule } from './tokens/token.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, ApplicationModule, TokenModule],
  exports: [AppConfigModule, DatabaseModule, ApplicationModule, TokenModule],
})
export class SystemModule {}
