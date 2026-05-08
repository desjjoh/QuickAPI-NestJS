import {
  INestApplication,
  NestApplicationOptions,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import path from 'path';
import * as fs from 'fs';
import cookieParser from 'cookie-parser';

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

import { rootPath } from '@/common/helpers/path.helper';

const app: INestApplication | null = null;
let ready: boolean = false;

function createApp(app: INestApplication): void {
  // Resolve and attach request context store
  const requestContext = app.get(RequestContext);
  attachRequestContext(requestContext);

  // MIDDLEWARE
  app.use(requestContextMiddleware());
  app.use(outgoingLogger());
  app.use(httpMetricsMiddleware);
  app.use(cookieParser());

  app.use(securityHeadersMiddleware());
  app.use(
    corsMiddleware({
      origin: env.CORS_ORIGINS,
      methods: env.CORS_METHODS,
      allowedHeaders: env.CORS_ALLOWED_HEADERS,
      exposedHeaders: env.CORS_EXPOSED_HEADERS,
      credentials: env.CORS_CREDENTIALS,
      maxAge: env.CORS_MAX_AGE_SECONDS,
    }),
  );

  app.use(
    rateLimitMiddleware({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      keyGenerator: (req) => req.ip ?? 'unknown',
    }),
  );

  app.use(
    methodWhitelistMiddleware({
      allowedMethods: env.ALLOWED_HTTP_METHODS,
    }),
  );

  app.use(
    headerLimitsMiddleware({
      maxHeaderCount: env.HEADER_MAX_COUNT,
      maxSingleHeaderBytes: env.HEADER_MAX_SINGLE_BYTES,
      maxTotalHeaderBytes: env.HEADER_MAX_TOTAL_BYTES,
      allowChunked: env.HEADER_ALLOW_CHUNKED,
    }),
  );

  app.use(sanitizeHeadersMiddleware());

  app.use(
    contentTypeMiddleware({
      defaultAllowed: env.ALLOWED_CONTENT_TYPES,
      routeOverrides: [],
    }),
  );

  app.use(
    bodyLimitMiddleware({
      defaultLimit: env.REQUEST_BODY_LIMIT_BYTES,
      routeOverrides: [],
    }),
  );

  // INTERCEPTORS
  app.useGlobalInterceptors(new TimeoutInterceptor(env.REQUEST_TIMEOUT_MS));

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

function resolveCertPath(certPath: string): string {
  return path.isAbsolute(certPath) ? certPath : path.join(rootPath, certPath);
}

export function createNestOptions(
  appLogger: NestApplicationOptions['logger'],
): NestApplicationOptions {
  const options: NestApplicationOptions = {
    logger: appLogger,
    rawBody: false,
  };

  if (env.HTTPS_ENABLED) {
    options.httpsOptions = {
      key: fs.readFileSync(resolveCertPath(env.HTTPS_KEY_PATH!)),
      cert: fs.readFileSync(resolveCertPath(env.HTTPS_CERT_PATH!)),
    };
  }

  return options;
}

export async function startNest(): Promise<void> {
  const appLogger: AppLogger = new AppLogger();

  const app: INestApplication = await NestFactory.create(
    AppModule,
    createNestOptions(appLogger),
  );

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
