import { logger } from '@/config/logger.config';

type LifecycleService = {
  name: string;
  check?: () => Promise<boolean> | boolean;
  start?: () => Promise<void> | void;
  stop?: () => Promise<void> | void;
};

export class LifecycleHandler {
  private static startupServices: LifecycleService[] = [];
  private static shutdownServices: LifecycleService[] = [];

  private static startupStarted: boolean = false;
  private static startupCompleted: boolean = false;

  private static shutdownStarted: boolean = false;

  public static isAlive(): boolean {
    return !this.shutdownStarted;
  }

  public static isReady(): boolean {
    return this.startupCompleted && !this.shutdownStarted;
  }

  public static async areAllServicesHealthy(): Promise<boolean> {
    for (const service of this.startupServices) {
      if (service.check) {
        const healthy: boolean = await service.check();

        if (!healthy) return false;
      }
    }

    return true;
  }

  public static register = (services: LifecycleService[]): void => {
    const start: number = performance.now();
    logger.debug(`Registering lifecycle services (${services.length} total)`);

    for (const service of services) {
      this.startupServices.push(service);
      this.shutdownServices.unshift(service);
    }

    ['SIGINT', 'SIGTERM'].forEach((sig: string) => {
      process.once(sig, () => {
        logger.warn(`${sig} received — initiating shutdown`);
        void this.shutdown().catch((err: unknown) => {
          const error: Error =
            err instanceof Error ? err : new Error(String(err));

          logger.error(
            { stack: error.stack },
            `Shutdown error: ${String(err)}`,
          );
          process.exit(1);
        });
      });
    });

    this.registerInternalHandlers();

    const duration: string = (performance.now() - start).toFixed(2);
    logger.debug(`Lifecycle registration completed in ${duration}ms`);
  };

  private static registerInternalHandlers(): void {
    process.on('uncaughtException', (err: unknown) => {
      const error: Error = err instanceof Error ? err : new Error(String(err));
      logger.error(
        { stack: error.stack },
        `Uncaught exception — ${error.message}`,
      );

      logger.fatal('Fatal error caused by uncaught exception — forcing exit');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error({ reason }, `Unhandled rejection — ${String(reason)}`);

      logger.fatal('Fatal error handling promise rejection — forcing exit');
      process.exit(1);
    });

    process.on('exit', (code: number) => {
      logger.info(`Application exited (code ${code})`);
    });
  }

  public static startup = async (): Promise<void> => {
    if (this.startupStarted) return;
    this.startupStarted = true;

    const start: number = performance.now();
    logger.debug(`Starting services…`);

    for (const service of this.startupServices) {
      if (!service.start) continue;

      await service.start();
      logger.debug(`Service started → ${service.name}`);
    }

    this.startupCompleted = true;

    const duration: string = (performance.now() - start).toFixed(2);
    logger.debug(`All services started in ${duration}ms`);
  };

  public static shutdown = async (): Promise<void> => {
    if (this.shutdownStarted) return;

    const start: number = performance.now();
    logger.debug('Stopping services…');

    this.shutdownStarted = true;

    for (const service of this.shutdownServices) {
      try {
        if (!service.stop) continue;
        await service.stop();

        logger.debug(`Service stopped ← ${service.name}`);
      } catch (err: unknown) {
        const error: Error =
          err instanceof Error ? err : new Error(String(err));

        logger.error({ stack: error.stack }, `Error — ${error.message}`);
        logger.warn(`Failed to stop service → ${service.name}`);
      }
    }

    const duration: string = (performance.now() - start).toFixed(2);
    logger.debug(`Shutdown completed in ${duration}ms`);

    process.exit(0);
  };
}
