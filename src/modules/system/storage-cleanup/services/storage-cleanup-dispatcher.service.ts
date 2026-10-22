import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { logger } from '@/config/logger.config';
import { StorageCleanupService } from './storage-cleanup.service';

@Injectable()
export class StorageCleanupDispatcher implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;

  public constructor(private readonly cleanup: StorageCleanupService) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => this.tick(), 5000);
    this.timer.unref();
    this.tick();
  }

  private tick(): void {
    if (this.running) return;
    this.running = this.cleanup
      .dispatch()
      .catch(() => logger.error('Storage cleanup sweep failed.'))
      .finally(() => {
        this.running = undefined;
      });
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
