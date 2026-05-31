import { RequestContext } from '@/common/store/request-context.store';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [RequestContext],
  exports: [RequestContext],
})
export class RequestContextModule {}
