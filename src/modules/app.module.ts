import { Module } from '@nestjs/common';

import { AppConfigModule } from '@/modules/system/configuration/config.module';
import { DatabaseModule } from '@/modules/system/database/database.module';
import { AppController } from '@/modules/system/application/controllers/app.controller';

import { RequestContext } from '@/common/store/request-context.store';

@Module({
  imports: [AppConfigModule, DatabaseModule],
  controllers: [AppController],
  providers: [RequestContext],
})
export class AppModule {}
