import { checkNest, startNest, stopNest } from '@/config/nest.config';
import { LifecycleHandler } from './handlers/lifecycle.handler';

import { logger } from '@/config/logger.config';
import { env } from '@/config/environment.config';

async function bootstrap(): Promise<void> {
  const { register, startup } = LifecycleHandler;

  const mode = env.NODE_ENV;
  const pro_v = process.version;

  logger.info(
    `Booting ${env.APP_NAME} v${env.APP_VERSION} (${mode}) — Node.js ${pro_v}`,
  );

  register([
    {
      name: 'http server (nest)',
      start: startNest,
      stop: stopNest,
      check: checkNest,
    },
  ]);

  await startup();

  logger.info(`HTTP server running on port 4000 — http://localhost:4000/docs`);
}

bootstrap().catch((err: unknown) => {
  const error: Error = err instanceof Error ? err : new Error(String(err));
  logger.error({ stack: error.stack }, `Error — ${error.message}`);

  logger.fatal('Fatal error during application bootstrap — forcing exit');
  process.exit(1);
});
