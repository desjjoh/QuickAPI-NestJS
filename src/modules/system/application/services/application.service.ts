import os from 'node:os';

import { Inject, Injectable } from '@nestjs/common';

import { LC } from '@/common/handlers/lifecycle.handler';

import {
  HealthResponseDto,
  RootResponseDto,
  ReadyResponseDto,
  InfoResponseDto,
  SystemResponseDto,
} from '../models';

import { InfoResponseParams } from '../models/_info.model';
import { APP_ENV, type AppEnv } from '@/config/environment.config';
import { HealthIndicatorService } from '../indicators/typeorm.indicator';
import { DbStatus, SystemResponseParams } from '../models/_system.model';
import { getEventLoopLag } from '@/common/helpers/event-loop.helper';
import { mode } from '@/config/environment.config';

@Injectable()
export class ApplicationControllerService {
  constructor(
    @Inject(APP_ENV)
    private readonly env: AppEnv,
    private readonly health: HealthIndicatorService,
  ) {}

  public get_root(message: string): RootResponseDto {
    return new RootResponseDto(message);
  }

  public get_health(): HealthResponseDto {
    const alive: boolean = LC.isAlive();
    const uptime: number = Number(process.uptime().toFixed(3));
    const timestamp: string = new Date().toISOString();

    return new HealthResponseDto(alive, uptime, timestamp);
  }

  public async get_ready(): Promise<ReadyResponseDto> {
    const lifecycleReady: boolean = LC.isReady();

    const typeormStatus: DbStatus = await this.health.get_typeorm_status();
    const typeormReady: boolean = typeormStatus === 'connected';

    const ready = lifecycleReady && typeormReady;

    return new ReadyResponseDto(ready);
  }

  public get_info(): InfoResponseDto {
    const name: string = this.env.APP_NAME;
    const version: string = this.env.APP_VERSION;
    const environment: mode = this.env.NODE_ENV;
    const hostname: string = os.hostname();
    const pid: number = process.pid;

    return new InfoResponseDto({
      name,
      version,
      environment,
      hostname,
      pid,
    } as InfoResponseParams);
  }

  public async get_system(): Promise<SystemResponseDto> {
    const uptime: number = Number(process.uptime().toFixed(3));
    const timestamp: number = Date.now();

    const lag_ms: number = await getEventLoopLag();
    const event_loop_lag: number = Number(lag_ms.toFixed(3));
    const db: DbStatus = await this.health.get_typeorm_status();

    return new SystemResponseDto({
      uptime,
      timestamp,
      event_loop_lag,
      db,
    } as SystemResponseParams);
  }
}
