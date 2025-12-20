import { checkNest, startNest, stopNest } from '@/config/nest.config';
import { LC } from './handlers/lifecycle.handler';

import { logger } from '@/config/logger.config';
import { env } from '@/config/environment.config';
import { mode } from '@/library/types/env.types';

async function bootstrap(): Promise<void> {
  const env_mode: mode = env.NODE_ENV;

  const name: string = env.APP_NAME;
  const version: string = env.APP_VERSION;
  const node_v: string = process.version;

  const port: number = env.PORT;

  logger.info(`Booting ${name} v${version} (${env_mode}) — Node.js ${node_v}`);

  LC.register([
    {
      name: 'http server (nest)',
      start: startNest,
      stop: stopNest,
      check: checkNest,
    },
  ]);

  await LC.startup();

  logger.info(`HTTP server running on port ${port} — http://localhost:${port}`);
}

bootstrap().catch((err: unknown) => {
  const error: Error = err instanceof Error ? err : new Error(String(err));
  logger.error({ stack: error.stack }, `Error — ${error.message}`);

  logger.fatal('Fatal error during application bootstrap — forcing exit');
  process.exit(1);
});
