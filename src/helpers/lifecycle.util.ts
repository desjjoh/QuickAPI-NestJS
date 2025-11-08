import { INestApplication } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import os from 'os';
import { AppLogger } from '@/modules/system/logger/services/logger.service';

export class SystemLifecycle {
  private static shuttingDown = false;

  static register(
    app: INestApplication,
    logger: AppLogger,
    start = performance.now(),
  ): void {
    const context = 'SystemLifecycle';

    const shutdown = async (signal: string): Promise<void> => {
      if (this.shuttingDown) return;
      this.shuttingDown = true;

      const initiated = performance.now();
      const uptime = (initiated - start).toFixed(2);

      logger.warn(`${signal} received — initiating graceful shutdown`, {
        context,
        signal,
        uptime,
        pid: process.pid,
        hostname: os.hostname(),
      });

      try {
        await app.close();
        logger.log('Nest application closed', { context });

        const duration = (performance.now() - initiated).toFixed(2);
        logger.log(`Shutdown complete in ${duration}ms`, {
          context,
          duration,
        });

        process.exit(0);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);

        logger.error('Error during shutdown — forcing exit', undefined, {
          context,
          reason,
        });

        process.exit(1);
      }
    };

    ['SIGINT', 'SIGTERM'].forEach((sig) => {
      process.once(sig, () => void shutdown(sig));
    });

    process.once('beforeExit', (code) => {
      const duration = (performance.now() - start).toFixed(2);
      logger.log(`Process exiting after ${duration}ms`, {
        context,
        code,
        duration,
      });
    });
  }
}
