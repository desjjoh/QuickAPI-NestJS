import { EntityManager } from 'typeorm';

import { logger } from '@/config/logger.config';

import type { Seeder } from '../types/seeder.types';

type SeederTotals = {
  created: number;
  skipped: number;
};

export class SeederService {
  public constructor(
    private readonly manager: EntityManager,
    private readonly seeders: Seeder[],
    private readonly group: string,
  ) {}

  public async run(): Promise<void> {
    const start: number = performance.now();
    const orderedSeeders: Seeder[] = [...this.seeders].sort(
      (a: Seeder, b: Seeder) => a.order - b.order,
    );

    logger.debug(
      `Running seeder group → ${this.group} (${orderedSeeders.length} total)`,
    );

    try {
      const totals: SeederTotals = await this.runSeeders(orderedSeeders);
      const duration: string = (performance.now() - start).toFixed(2);

      logger.debug(
        `Seeder completed in ${duration}ms — created=${totals.created} skipped=${totals.skipped}`,
      );
    } catch (err: unknown) {
      const error: Error = err instanceof Error ? err : new Error(String(err));

      logger.error(
        { stack: error.stack },
        `Seeder error [${this.group}] — ${error.message}`,
      );

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
        const result = await seeder.run(this.manager);

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
