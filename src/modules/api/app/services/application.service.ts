import os from 'node:os';

import { Injectable } from '@nestjs/common';
import { LC } from '@/common/handlers/lifecycle.handler';

import {
  HealthResponseDto,
  RootResponseDto,
  ReadyResponseDto,
  InfoResponseDto,
  SystemResponseDto,
  DependencyCheckDto,
} from '../models';

import { InfoResponseParams } from '../models/_info.model';
import { env } from '@/config/environment.config';
import { SystemResponseParams } from '../models/_system.model';
import { getEventLoopLag } from '@/common/helpers/event-loop.helper';

import { TypeOrmService } from '@/modules/system/database/services/typeorm.service';
import { DbStatus } from '@/modules/system/database/types/database.types';
import { mode } from '@/config/environment.schema';

@Injectable()
export class ApplicationControllerService {
  constructor(private readonly health: TypeOrmService) {}

  public get_root(message: string): RootResponseDto {
    return new RootResponseDto(message);
  }

  private async get_database_check(): Promise<DependencyCheckDto> {
    const start = performance.now();
    const status = await this.health.get_status();

    return new DependencyCheckDto(
      'database',
      status === 'connected' ? 'up' : 'down',
      Number((performance.now() - start).toFixed(3)),
    );
  }

  public async get_health(): Promise<HealthResponseDto> {
    const alive: boolean = LC.isAlive();
    const uptime: number = Number(process.uptime().toFixed(3));
    const timestamp: string = new Date().toISOString();

    return new HealthResponseDto(alive, uptime, timestamp, [
      await this.get_database_check(),
    ]);
  }

  public async get_ready(): Promise<ReadyResponseDto> {
    const lifecycleReady: boolean =
      LC.isReady() && (await LC.areAllServicesHealthy());

    const database = await this.get_database_check();
    const typeormReady: boolean = database.status === 'up';

    const ready = lifecycleReady && typeormReady;

    return new ReadyResponseDto(ready, [
      new DependencyCheckDto('lifecycle', lifecycleReady ? 'up' : 'down', 0),
      database,
    ]);
  }

  public get_info(): InfoResponseDto {
    const name: string = env.APP_NAME;
    const version: string = env.APP_VERSION;
    const environment: mode = env.NODE_ENV;
    const hostname: string = os.hostname();
    const pid: number = process.pid;
    const started_at = new Date(
      Date.now() - process.uptime() * 1000,
    ).toISOString();

    return new InfoResponseDto({
      name,
      version,
      environment,
      hostname,
      pid,
      node_version: process.version,
      platform: process.platform,
      architecture: process.arch,
      started_at,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    } as InfoResponseParams);
  }

  public async get_system(): Promise<SystemResponseDto> {
    const uptime: number = Number(process.uptime().toFixed(3));
    const timestamp: number = Date.now();

    const lag_ms: number = await getEventLoopLag();
    const event_loop_lag: number = Number(lag_ms.toFixed(3));
    const db: DbStatus = await this.health.get_status();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = process.memoryUsage();
    const cpus = os.cpus();

    return new SystemResponseDto({
      uptime,
      timestamp,
      event_loop_lag,
      db,
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model ?? 'unknown',
        load_average: os.loadavg().map((load) => Number(load.toFixed(3))),
      },
      memory: {
        total_bytes: totalMemory,
        free_bytes: freeMemory,
        used_bytes: usedMemory,
        used_percent: Number(((usedMemory / totalMemory) * 100).toFixed(2)),
      },
      process: {
        rss_bytes: memoryUsage.rss,
        heap_total_bytes: memoryUsage.heapTotal,
        heap_used_bytes: memoryUsage.heapUsed,
        external_bytes: memoryUsage.external,
        active_handles: process.getActiveResourcesInfo().length,
      },
      os: {
        type: os.type(),
        release: os.release(),
        uptime: Number(os.uptime().toFixed(3)),
      },
    } as SystemResponseParams);
  }
}
