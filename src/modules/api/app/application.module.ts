import { Module } from '@nestjs/common';

import { ApplicationController } from './controllers/application.controller';
import { ApplicationControllerService } from './services/application.service';

import { TypeOrmService } from '@/modules/system/database/services/typeorm.service';
import { AppConfigModule } from '@/modules/system/configuration/config.module';

@Module({
  imports: [AppConfigModule],
  providers: [TypeOrmService, ApplicationControllerService],
  controllers: [ApplicationController],
})
export class ApplicationModule {}
