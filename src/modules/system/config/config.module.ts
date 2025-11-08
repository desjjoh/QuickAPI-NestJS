import os from 'os';
import z from 'zod';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppLogger } from '@/modules/system/logger/services/logger.service';

import { envSchema } from './env.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      cache: true,

      validate: (config: Record<string, unknown>) => {
        const parsed = envSchema.safeParse(config);

        if (!parsed.success) {
          const logger = new AppLogger();
          const zodError = parsed.error as z.ZodError;

          const metadata = {
            context: AppConfigModule.name,
            pid: process.pid,
            hostname: os.hostname(),
          };

          logger.error(
            'Invalid environment configuration',
            undefined,
            metadata,
          );

          for (const issue of zodError.issues) {
            logger.error(
              `\t- ${issue.path.join('.')}: ${issue.message}`,
              undefined,
              metadata,
            );
          }

          process.exit(1);
        }

        return parsed.data;
      },
    }),
  ],
})
export class AppConfigModule {}
