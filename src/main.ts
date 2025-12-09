import { checkNest, startNest, stopNest } from '@/config/nest.config';
import { LC } from './handlers/lifecycle.handler';

import { logger } from '@/config/logger.config';
import { env } from '@/config/environment.config';

async function bootstrap(): Promise<void> {
  const mode: 'development' | 'test' | 'production' = env.NODE_ENV;
  const pro_v: string = process.version;

  logger.info(
    `Booting ${env.APP_NAME} v${env.APP_VERSION} (${mode}) — Node.js ${pro_v}`,
  );

  LC.register([
    {
      name: 'http server (nest)',
      start: startNest,
      stop: stopNest,
      check: checkNest,
    },
  ]);

  await LC.startup();

  logger.info(
    `HTTP server running on port ${env.PORT} — http://localhost:${env.PORT}/docs`,
  );
}

bootstrap().catch((err: unknown) => {
  const error: Error = err instanceof Error ? err : new Error(String(err));
  logger.error({ stack: error.stack }, `Error — ${error.message}`);

  logger.fatal('Fatal error during application bootstrap — forcing exit');
  process.exit(1);
});
