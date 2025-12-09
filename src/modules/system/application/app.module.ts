import { Module } from '@nestjs/common';

import { AppConfigModule } from '@/modules/system/configuration/config.module';

import { AppController } from './controllers/app.controller';

@Module({
  imports: [AppConfigModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
