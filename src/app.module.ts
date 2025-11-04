import { Module } from '@nestjs/common';

import { AppConfigModule } from '@/modules/config/config.module';
import { AppLoggerModule } from '@/modules/logger/logger.module';

import { AppController } from '@/modules/app/controllers/app.controller';

import { AppService } from '@/modules/app/services/app.service';

@Module({
  imports: [AppConfigModule, AppLoggerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
