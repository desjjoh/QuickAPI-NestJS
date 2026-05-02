import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';

import { DomainModule } from '@/modules/domain/domain.module';

import { RequestContext } from '@/common/store/request-context.store';
import { ApiModule } from './api/api.module';
import { SystemModule } from './system/system.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { minute } from '@/common/constants/milliseconds.constants';
import { LocalStrategy } from '@/common/strategies/local.strategy';
import { RefreshTokenStrategy } from '@/common/strategies/refresh.strategy';
import { IdentityService } from './domain/identity/services/identity.service';
import { UserRepository } from './domain/identity/repositories/user.repository';
import { AccessTokenStrategy } from '@/common/strategies/access.strategy';

const rootPath = join(process.cwd(), 'public');
const serveRoot = '/';

@Module({
  imports: [
    ServeStaticModule.forRoot({ rootPath, serveRoot }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 1 * minute, limit: 20 }] }),

    SystemModule,
    DomainModule,
    ApiModule,
  ],
  providers: [
    RequestContext,
    IdentityService,
    UserRepository,

    LocalStrategy,
    RefreshTokenStrategy,
    AccessTokenStrategy,
  ],
})
export class AppModule {}
