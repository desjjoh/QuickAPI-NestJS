import { Module } from '@nestjs/common';

import { ApplicationController } from './controllers/application.controller';
import { ApplicationControllerService } from './services/application.service';
import { AppConfigModule } from '../configuration/config.module';
import { HealthIndicatorService } from './indicators/typeorm.indicator';
import { TokenModule } from '../tokens/token.module';

@Module({
  imports: [AppConfigModule, TokenModule],
  providers: [HealthIndicatorService, ApplicationControllerService],
  controllers: [ApplicationController],
})
export class ApplicationModule {}
