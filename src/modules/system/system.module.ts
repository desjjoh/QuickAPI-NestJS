import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module';
import { TokenModule } from './tokens/token.module';

@Module({
  imports: [DatabaseModule, TokenModule],
  exports: [DatabaseModule, TokenModule],
})
export class SystemModule {}
