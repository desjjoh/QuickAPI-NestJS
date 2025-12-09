import {
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '@/modules/system/application/app.module';

import { AppLogger } from '@/common/loggers/pino.logger';
import { SwaggerConfig } from './docs.config';

import { env } from './environment.config';
import { HttpLoggingInterceptor } from '@/common/interceptors/http.interceptor';
import { ValidationException } from '@/common/exceptions/validation.exception';
import { GlobalExceptionFilter } from '@/common/filters/global-exception.filter';
import {
  attachRequestContext,
  RequestContext,
} from '@/common/store/request-context.store';

let app: INestApplication | null = null;
let ready: boolean = false;

function createApp(app: INestApplication): void {
  const requestContext = app.get(RequestContext);
  attachRequestContext(requestContext);

  // INTERCEPTORS
  app.useGlobalInterceptors(new HttpLoggingInterceptor());

  // PIPES
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: (errors: ValidationError[]) =>
        new ValidationException(errors),
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
  app = await NestFactory.create(AppModule, { logger: appLogger });

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
