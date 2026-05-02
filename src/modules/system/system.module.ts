import { Module } from '@nestjs/common';

import { AppConfigModule } from './configuration/config.module';
import { DatabaseModule } from './database/database.module';
import { TokenModule } from './tokens/token.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, TokenModule],
  exports: [AppConfigModule, DatabaseModule, TokenModule],
})
export class SystemModule {}
