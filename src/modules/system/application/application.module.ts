import { Module } from '@nestjs/common';

import { AppController } from './controllers/app.controller';
import { AppService } from './services/app.service';

@Module({
  imports: [],
  providers: [AppService],
  controllers: [AppController],
})
export class ApplicationModule {}
