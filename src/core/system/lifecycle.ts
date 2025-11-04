import { INestApplication } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import os from 'os';
import { AppLogger } from '@/modules/logger/services/logger.service';

/**
 * @fileoverview Application lifecycle manager for graceful startup and shutdown.
 * @module system/lifecycle
 * @description
 * Provides structured shutdown handling for NestJS applications.
 * Ensures that open HTTP connections, Prisma sessions, and background tasks
 * are closed gracefully upon receiving termination signals.
 *
 * ---
 * ### Features
 * - Handles SIGINT, SIGTERM, and process `beforeExit` events.
 * - Prevents duplicate shutdown via static guard.
 * - Logs uptime and total shutdown duration.
 * - Ensures exit code 1 on failure.
 *
 * ---
 * ### Example
 * ```ts
 * // main.ts
 * import { SystemLifecycle } from '@/system/lifecycle';
 *
 * const app = await NestFactory.create(AppModule, { bufferLogs: true });
 * const log = app.get(AppLogger);
 * const prisma = app.get(PrismaService);
 * await app.listen(3000);
 *
 * SystemLifecycle.register(app, log, prisma);
 * ```
 */
export class SystemLifecycle {
  /** Prevents multiple shutdown executions. */
  private static shuttingDown = false;

  /**
   * Registers system signal handlers and orchestrates graceful shutdown.
   *
   * @param app - The active NestJS application instance.
   * @param logger - Centralized application logger.
   * @param prisma - PrismaService (optional) for DB disconnection.
   * @param start - Timestamp (ms) when the app was initialized.
   */
  static register(
    app: INestApplication,
    logger: AppLogger,
    start = performance.now(),
  ): void {
    const context = 'SystemLifecycle';

    /**
     * Handles termination signals (SIGINT, SIGTERM)
     * and executes cleanup routines.
     */
    const shutdown = async (signal: string): Promise<void> => {
      if (this.shuttingDown) return;
      this.shuttingDown = true;

      const initiated = performance.now();
      const uptime = (initiated - start).toFixed(2);

      logger.warn(`[exit] ${signal} received — initiating graceful shutdown`, {
        context,
        signal,
        uptime,
        pid: process.pid,
        hostname: os.hostname(),
      });

      try {
        // Step 1 — Stop accepting new connections and close Nest HTTP server
        await app.close();
        logger.log('[exit] Nest application closed', { context });

        // Step 2 — Finalize shutdown duration
        const duration = (performance.now() - initiated).toFixed(2);
        logger.log(`[exit] Shutdown complete in ${duration}ms`, {
          context,
          duration,
        });

        process.exit(0);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);

        logger.error('[exit] Error during shutdown — forcing exit', undefined, {
          context,
          reason,
        });

        process.exit(1);
      }
    };

    // Bind OS signals for graceful termination
    ['SIGINT', 'SIGTERM'].forEach((sig) => {
      process.once(sig, () => void shutdown(sig));
    });

    // Hook into Node’s lifecycle for consistent exit logging
    process.once('beforeExit', (code) => {
      const duration = (performance.now() - start).toFixed(2);
      logger.log(`[exit] Process exiting after ${duration}ms`, {
        context,
        code,
        duration,
      });
    });
  }
}
