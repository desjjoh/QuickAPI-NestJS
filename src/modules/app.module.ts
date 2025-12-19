import { Module } from '@nestjs/common';

import { DomainModule } from '@/modules/domain/domain.module';

import { RequestContext } from '@/common/store/request-context.store';
import { ApiModule } from './api/api.module';
import { SystemModule } from './system/system.module';

@Module({
  imports: [SystemModule, DomainModule, ApiModule],
  providers: [RequestContext],
})
export class AppModule {}
