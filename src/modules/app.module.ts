import { MiddlewareConsumer, Module } from '@nestjs/common';

import { AppConfigModule } from '@/modules/system/configuration/config.module';

import { AppController } from '@/modules/system/application/controllers/app.controller';

import { RequestContext } from '@/common/store/request-context.store';

import { RequestContextMiddleware } from '@/common/middleware/request-context.middleware';
import { SecurityHeadersMiddleware } from '@/common/middleware/secuirty-headers.middleware';
import {
  HEADER_LIMITS_TOKEN,
  HeaderLimits,
  HeaderLimitsMiddleware,
} from '@/common/middleware/header-limit.middleware';
import { SanitizeHeadersMiddleware } from '@/common/middleware/header-sanitization.middleware';
import {
  METHOD_WHITELIST_TOKEN,
  MethodWhitelistMiddleware,
  MethodWhitelistOptions,
} from '@/common/middleware/method-whitelist.middleware';
import {
  CONTENT_TYPE_OPTIONS,
  ContentTypeMiddleware,
  ContentTypeOptions,
} from '@/common/middleware/content-type.middleware';
import {
  BODY_LIMIT_OPTIONS,
  BodyLimitMiddleware,
  BodyLimitOptions,
} from '@/common/middleware/request-size-limit.middleware';

@Module({
  imports: [AppConfigModule],
  controllers: [AppController],
  providers: [
    RequestContext,
    {
      provide: HEADER_LIMITS_TOKEN,
      useValue: <HeaderLimits>{
        maxHeaderCount: 100,
        maxSingleHeaderBytes: 4_096,
        maxTotalHeaderBytes: 8_192,
        allowChunked: false,
      },
    },
    {
      provide: METHOD_WHITELIST_TOKEN,
      useValue: <MethodWhitelistOptions>{
        allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      },
    },
    {
      provide: CONTENT_TYPE_OPTIONS,
      useValue: <ContentTypeOptions>{
        defaultAllowed: ['application/json', 'multipart/form-data'],
        routeOverrides: [],
      },
    },
    {
      provide: BODY_LIMIT_OPTIONS,
      useValue: <BodyLimitOptions>{
        defaultLimit: 1_048_576,
        routeOverrides: [],
      },
    },

    ContentTypeMiddleware,
    HeaderLimitsMiddleware,
    MethodWhitelistMiddleware,
    BodyLimitMiddleware,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        RequestContextMiddleware,
        SanitizeHeadersMiddleware,
        HeaderLimitsMiddleware,
        ContentTypeMiddleware,
        MethodWhitelistMiddleware,
        BodyLimitMiddleware,
        SecurityHeadersMiddleware,
      )
      .forRoutes('*');
  }
}
