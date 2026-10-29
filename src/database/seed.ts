import dataSource from './typeorm.datasource';
import { runSeedCommand } from './seeders';
import { logger } from '@/config/logger.config';

// Database-only entry point: never bootstrap the application or its workers.
void runSeedCommand(dataSource).then(
  () => logger.info('Database seeding committed.'),
  (error: unknown) => {
    // Connection failures precede group logging. Report their code without
    // dumping connection options, SQL parameters, or credentials.
    const code =
      error !== null && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : undefined;

    logger.error(
      { code, errorType: error instanceof Error ? error.name : 'UnknownError' },
      'Database seed command failed.',
    );
    process.exitCode = 1;
  },
);
