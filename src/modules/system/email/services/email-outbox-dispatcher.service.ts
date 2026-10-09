import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { logger } from '@/config/logger.config';
import { EmailOutboxService } from './email-outbox.service';

@Injectable()
export class EmailOutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  public constructor(private readonly outbox: EmailOutboxService) {}
  public onModuleInit(): void {
    this.timer = setInterval(() => this.tick(), 5_000);
    this.timer.unref();
    this.tick();
  }
  private tick(): void {
    if (this.running) return;
    this.running = this.outbox
      .dispatch()
      .catch(() => logger.error('Email outbox sweep failed.'))
      .finally(() => {
        this.running = undefined;
      });
  }
  public async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
