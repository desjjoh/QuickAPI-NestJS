import { DynamicModule, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { isAbsolute, join } from 'node:path';

import { env } from '@/config/environment.config';
import { RequestContext } from '@/common/store/request-context.store';
import { AccessTokenStrategy } from '@/common/strategies/access.strategy';
import { minute } from '@/common/constants/milliseconds.constants';
import { LocalStrategy } from '@/common/strategies/local.strategy';
import { RefreshTokenStrategy } from '@/common/strategies/refresh.strategy';

import { DomainModule } from '@/modules/domain/domain.module';

import { ApiModule } from './api/api.module';
import { SystemModule } from './system/system.module';
import { UserService } from './domain/identity/services/user.service';
import { UserRepository } from './domain/identity/repositories/user.repository';

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
    UserService,
    UserRepository,

    LocalStrategy,
    RefreshTokenStrategy,
    AccessTokenStrategy,
  ],
})
export class AppModule {}
