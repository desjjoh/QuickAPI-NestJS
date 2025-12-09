import { MiddlewareConsumer, Module } from '@nestjs/common';

import { AppConfigModule } from '@/modules/system/configuration/config.module';

import { AppController } from './controllers/app.controller';
import { RequestContext } from '@/common/store/request-context.store';
import { RequestContextMiddleware } from '@/common/middleware/request-context.middleware';

@Module({
  imports: [AppConfigModule],
  controllers: [AppController],
  providers: [RequestContext],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
