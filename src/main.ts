import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { AppModule } from '@/app.module';
import { AppLogger } from '@/logger/services/logger.service';
import { GlobalExceptionFilter } from '@/errors/global-exception.filter';
import { SystemLifecycle } from '@/system/lifecycle';

async function bootstrap(): Promise<void> {
  const context = bootstrap.name;
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get(ConfigService);
  const log = app.get(AppLogger);
  const port = config.get<number>('PORT') ?? 3000;

  app.useLogger(log);
  app.useGlobalFilters(new GlobalExceptionFilter(log));

  await app.listen(port);

  SystemLifecycle.register(app, log);

  log.log(`🚀 Server running on http://localhost:${port}`, { context });
}

/**
 * Global bootstrap call wrapped in fail-fast handling.
 * Any uncaught startup error will be logged and terminate the process gracefully.
 */
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
    // fallback if the import fails
    process.stderr.write('Fatal error during application bootstrap');
  }

  process.exit(1);
});
