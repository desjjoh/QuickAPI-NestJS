import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';

import { DomainModule } from '@/modules/domain/domain.module';

import { RequestContext } from '@/common/store/request-context.store';
import { ApiModule } from './api/api.module';
import { SystemModule } from './system/system.module';

const rootPath = join(process.cwd(), 'public');
const serveRoot = '/';

@Module({
  imports: [
    ServeStaticModule.forRoot({ rootPath, serveRoot }),
    SystemModule,
    DomainModule,
    ApiModule,
  ],
  providers: [RequestContext],
})
export class AppModule {}
