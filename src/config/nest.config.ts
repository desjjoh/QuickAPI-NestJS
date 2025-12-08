// import { json } from 'express';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '@/modules/system/application/app.module';

import { AppLogger } from '@/common/loggers/pino.logger';
import { SwaggerConfig } from './docs.config';

let app: INestApplication | null = null;
let ready: boolean = false;

function createApp(app: INestApplication): void {
  SwaggerConfig.setup(app);
}

export async function startNest(): Promise<void> {
  const appLogger = new AppLogger();
  app = await NestFactory.create(AppModule, { logger: appLogger });

  createApp(app);

  await app.listen(4000);
  ready = true;
}

export async function stopNest(): Promise<void> {
  if (!app) return;

  await app.close();
  ready = false;
}

export function checkNest(): boolean {
  return ready;
}
