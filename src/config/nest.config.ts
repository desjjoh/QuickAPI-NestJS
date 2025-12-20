import {
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { SwaggerConfig } from './docs.config';
import { env } from './environment.config';

import { AppModule } from '@/modules/app.module';
import { GlobalExceptionFilter } from '@/common/filters/global.filter';
import {
  attachRequestContext,
  RequestContext,
} from '@/common/store/request-context.store';
import { AppLogger } from '@/common/loggers/nest.logger';
import { ValidationErrorException } from '@/common/exceptions/http.exception';
import { TimeoutInterceptor } from '@/common/interceptors/timeout.interceptor';
import { outgoingLogger } from '@/common/middleware/logger.middleware';
import { NotFoundFilter } from '@/common/filters/not-found.filter';
import { requestContextMiddleware } from '@/common/middleware/request-context.middleware';
import { sanitizeHeadersMiddleware } from '@/common/middleware/header-sanitization.middleware';
import { methodWhitelistMiddleware } from '@/common/middleware/method-whitelist.middleware';
import { contentTypeMiddleware } from '@/common/middleware/content-type.middleware';
import { headerLimitsMiddleware } from '@/common/middleware/header-limit.middleware';
import { rateLimitMiddleware } from '@/common/middleware/rate-limit.middleware';
import { securityHeadersMiddleware } from '@/common/middleware/security-headers.middleware';
import { corsMiddleware } from '@/common/middleware/cors.middleware';
import { bodyLimitMiddleware } from '@/common/middleware/request-size-limit.middleware';
import { httpMetricsMiddleware } from '@/common/middleware/metrics.middleware';

let app: INestApplication | null = null;
let ready: boolean = false;

function createApp(app: INestApplication): void {
  // Resolve and attach request context store
  const requestContext = app.get(RequestContext);
  attachRequestContext(requestContext);

  // MIDDLEWARE
  app.use(requestContextMiddleware());
  app.use(outgoingLogger());
  app.use(httpMetricsMiddleware);

  app.use(securityHeadersMiddleware());
  app.use(
    corsMiddleware({
      origin: ['*'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      exposedHeaders: ['Authorization', 'Set-Cookie'],
      credentials: true,
      maxAge: 86_400,
    }),
  );

  app.use(
    rateLimitMiddleware({
      windowMs: 60_000,
      max: 200,
      keyGenerator: (req) => req.ip ?? 'unknown',
    }),
  );

  app.use(
    methodWhitelistMiddleware({
      allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );

  app.use(
    headerLimitsMiddleware({
      maxHeaderCount: 100,
      maxSingleHeaderBytes: 4_096,
      maxTotalHeaderBytes: 8_192,
      allowChunked: false,
    }),
  );

  app.use(sanitizeHeadersMiddleware());

  app.use(
    contentTypeMiddleware({
      defaultAllowed: ['application/json', 'multipart/form-data'],
      routeOverrides: [],
    }),
  );

  app.use(
    bodyLimitMiddleware({
      defaultLimit: 1_048_576,
      routeOverrides: [],
    }),
  );

  // INTERCEPTORS
  app.useGlobalInterceptors(new TimeoutInterceptor(5_000));

  // PIPES
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: (errors: ValidationError[]) =>
        new ValidationErrorException(errors),
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // FILTERS
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalFilters(new NotFoundFilter());

  SwaggerConfig.setup(app);
}

export async function startNest(): Promise<void> {
  const appLogger: AppLogger = new AppLogger();

  app = await NestFactory.create(AppModule, {
    logger: appLogger,
    rawBody: false,
  });

  createApp(app);

  await app.listen(env.PORT);
  ready = true;
}

export async function stopNest(): Promise<void> {
  if (!app) return;

  await app.close();
  ready = false;
}

export function checkNest(): boolean {
  return ready;
}
