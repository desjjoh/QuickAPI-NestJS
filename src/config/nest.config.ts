import {
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { SwaggerConfig } from './docs.config';
import { env } from './environment.config';

import { AppModule } from '@/modules/app.module';
import { GlobalExceptionFilter } from '@/common/filters/global-exception.filter';
import {
  attachRequestContext,
  RequestContext,
} from '@/common/store/request-context.store';
import { AppLogger } from '@/common/loggers/nest.logger';
import { ValidationErrorException } from '@/common/exceptions/http.exception';
import { TimeoutInterceptor } from '@/common/interceptors/timeout.interceptor';
import { outgoingLogger } from '@/common/middleware/logger.middleware';

let app: INestApplication | null = null;
let ready: boolean = false;

function createApp(app: INestApplication): void {
  const requestContext = app.get(RequestContext);
  attachRequestContext(requestContext);

  app.use(outgoingLogger());

  app.getHttpAdapter().getInstance().disable('x-powered-by');

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    maxAge: 86_400,
  });

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
