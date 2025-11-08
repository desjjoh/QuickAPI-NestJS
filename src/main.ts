import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { AppModule } from '@/app.module';
import { AppLogger } from '@/modules/system/logger/services/logger.service';
import { GlobalExceptionFilter } from '@/core/filters/global-exception.filter';
import { SystemLifecycle } from '@/helpers/lifecycle.util';
import { Swagger } from '@/helpers/swagger.util';
import { HttpLoggingInterceptor } from '@/core/interceptors/http.interceptor';

async function bootstrap(): Promise<void> {
  const context = bootstrap.name;
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get(ConfigService);
  const log = app.get(AppLogger);
  const port = config.get<number>('PORT') ?? 3000;

  const prefix = 'api';

  app.setGlobalPrefix(prefix);
  app.useLogger(log);

  app.useGlobalInterceptors(new HttpLoggingInterceptor(log));
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: (errors) => new BadRequestException(errors),
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter(log));

  Swagger.init(app, prefix);

  await app.listen(port);

  SystemLifecycle.register(app, log);

  log.log(`🚀 Server running on http://localhost:${port}/${prefix}`, {
    context,
    url: `http://localhost:${port}`,
    path: `/${prefix}`,
  });
}

bootstrap().catch((err: unknown) => {
  const context = bootstrap.name;
  try {
    const log = new AppLogger();

    log.error(
      'Fatal error during application bootstrap',
      (err as Error)?.stack,
      { context },
    );
  } catch {
    process.stderr.write('Fatal error during application bootstrap');
  }

  process.exit(1);
});
