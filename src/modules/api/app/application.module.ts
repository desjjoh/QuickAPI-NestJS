import { Module } from '@nestjs/common';

import { ApplicationController } from './controllers/application.controller';
import { ApplicationControllerService } from './services/application.service';

import { TypeOrmService } from '@/modules/system/database/services/typeorm.service';
import { AppConfigModule } from '@/modules/system/configuration/config.module';
import { TestController } from './controllers/test.controller';
import { EmailModule } from '@/modules/system/email/email.module';

@Module({
  imports: [AppConfigModule, EmailModule],
  providers: [TypeOrmService, ApplicationControllerService],
  controllers: [ApplicationController, TestController],
})
export class ApplicationModule {}
