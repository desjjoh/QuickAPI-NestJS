import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { env } from '@/config/environment.config';
import { logger } from '@/config/logger.config';

import { SEEDERS } from '../tokens/seeder.tokens';
import type { Seeder } from '../types/seeder.types';

type SeederTotals = {
  created: number;
  skipped: number;
};

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  public constructor(
    private readonly dataSource: DataSource,

    @Inject(SEEDERS)
    private readonly seeders: Seeder[],
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    if (!env.DB_SEED) return;

    const start: number = performance.now();
    const orderedSeeders: Seeder[] = [...this.seeders].sort(
      (a: Seeder, b: Seeder) => a.order - b.order,
    );

    logger.debug(`Running seeders (${orderedSeeders.length} total)`);

    try {
      const totals: SeederTotals = await this.runSeeders(orderedSeeders);
      const duration: string = (performance.now() - start).toFixed(2);

      logger.debug(
        `Seeders completed in ${duration}ms — created=${totals.created} skipped=${totals.skipped}`,
      );
    } catch (err: unknown) {
      const error: Error = err instanceof Error ? err : new Error(String(err));

      logger.error({ stack: error.stack }, `Seeder error — ${error.message}`);

      throw error;
    }
  }

  private async runSeeders(seeders: Seeder[]): Promise<SeederTotals> {
    const totals: SeederTotals = {
      created: 0,
      skipped: 0,
    };

    for (const seeder of seeders) {
      try {
        const result = await seeder.run(this.dataSource);

        totals.created += result.created;
        totals.skipped += result.skipped;
      } catch (err: unknown) {
        const error: Error =
          err instanceof Error ? err : new Error(String(err));

        logger.error({ stack: error.stack }, `Seeder failed → ${seeder.name}`);

        throw error;
      }
    }

    return totals;
  }
}
