import { DynamicModule, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { isAbsolute, join } from 'node:path';

import { env } from '@/config/environment.config';

import { AccessTokenStrategy } from '@/common/strategies/access.strategy';
import { minute } from '@/common/constants/milliseconds.constants';
import { LocalStrategy } from '@/common/strategies/local.strategy';
import { RefreshTokenStrategy } from '@/common/strategies/refresh.strategy';

import { DomainModule } from '@/modules/domain/domain.module';

import { ApiModule } from './api/api.module';
import { SystemModule } from './system/system.module';
import { RequestContextModule } from './system/context/context.module';
import { RedisThrottlerStorage } from '@/common/throttling/redis-throttler.storage';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { RouteContextInterceptor } from '@/common/interceptors/route-context.interceptor';

function resolveStaticRootPath(staticRootPath: string): string {
  return isAbsolute(staticRootPath)
    ? staticRootPath
    : join(process.cwd(), staticRootPath);
}

const staticImports: DynamicModule[] = env.STATIC_SERVE_ENABLED
  ? [
      ServeStaticModule.forRoot({
        rootPath: resolveStaticRootPath(env.STATIC_ROOT_PATH),
        serveRoot: env.STATIC_SERVE_ROOT,
      }),
    ]
  : [];

@Module({
  imports: [
    ...staticImports,
    ThrottlerModule.forRoot({
      storage: new RedisThrottlerStorage(),
      throttlers: [
        {
          ttl: env.GLOBAL_THROTTLE_TTL_MINUTES * minute,
          limit: env.GLOBAL_THROTTLE_LIMIT,
        },
      ],
    }),

    RequestContextModule,
    SystemModule,
    DomainModule,
    ApiModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RouteContextInterceptor },
    LocalStrategy,
    RefreshTokenStrategy,
    AccessTokenStrategy,
  ],
})
export class AppModule {}
