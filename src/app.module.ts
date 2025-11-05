import { Module } from '@nestjs/common';

import { AppConfigModule } from '@/modules/system/config/config.module';
import { AppLoggerModule } from '@/modules/system/logger/logger.module';
import { DatabaseModule } from '@/modules/system/database/database.module';

import { AppController } from '@/modules/api/app/controllers/app.controller';
import { AppService } from '@/modules/api/app/services/app.service';
import { ItemsModule } from '@/modules/domain/item/items.module';

@Module({
  imports: [AppConfigModule, AppLoggerModule, DatabaseModule, ItemsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
