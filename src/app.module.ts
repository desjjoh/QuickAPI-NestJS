import { Module } from '@nestjs/common';

import { AppConfigModule } from '@/modules/config/config.module';
import { AppLoggerModule } from '@/modules/logger/logger.module';

import { AppController } from '@/api/app/controllers/app.controller';

import { AppService } from '@/api/app/services/app.service';

@Module({
  imports: [AppConfigModule, AppLoggerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
