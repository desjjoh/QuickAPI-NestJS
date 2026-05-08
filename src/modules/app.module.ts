import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { isAbsolute, join } from 'node:path';

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
import { env } from '@/config/environment.config';

function resolveStaticRootPath(staticRootPath: string): string {
  return isAbsolute(staticRootPath)
    ? staticRootPath
    : join(process.cwd(), staticRootPath);
}

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: resolveStaticRootPath(env.STATIC_ROOT_PATH),
      serveRoot: env.STATIC_SERVE_ROOT,
    }),

    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: env.GLOBAL_THROTTLE_TTL_MINUTES * minute,
          limit: env.GLOBAL_THROTTLE_LIMIT,
        },
      ],
    }),

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
