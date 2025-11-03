import { Module } from '@nestjs/common';

import { AppConfigModule } from '@/config/config.module';
import { AppLoggerModule } from '@/logger/logger.module';

import { AppController } from '@/controllers/app.controller';

import { AppService } from '@/services/app.service';

@Module({
  imports: [AppConfigModule, AppLoggerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
