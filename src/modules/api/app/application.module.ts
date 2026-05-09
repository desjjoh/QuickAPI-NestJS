import { Module } from '@nestjs/common';

import { ApplicationController } from './controllers/application.controller';
import { ApplicationControllerService } from './services/application.service';

import { TypeOrmService } from '@/modules/system/database/services/typeorm.service';

@Module({
  imports: [],
  providers: [TypeOrmService, ApplicationControllerService],
  controllers: [ApplicationController],
})
export class ApplicationModule {}
