import { Module } from '@nestjs/common';

import { AppConfigModule } from '@/modules/config/config.module';
import { AppLoggerModule } from '@/modules/logger/logger.module';
import { DatabaseModule } from '@/modules/database/database.module';

import { AppController } from '@/api/app/controllers/app.controller';
import { AppService } from '@/api/app/services/app.service';
import { ItemsModule } from '@/api/item/items.module';

@Module({
  imports: [AppConfigModule, AppLoggerModule, DatabaseModule, ItemsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
