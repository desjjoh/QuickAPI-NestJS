import { DataSource } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { DbStatus } from '../models/_system.model';

@Injectable()
export class HealthIndicatorService {
  constructor(private readonly dataSource: DataSource) {}

  public async get_typeorm_status(): Promise<DbStatus> {
    if (this.dataSource.isInitialized) return 'connected';

    return 'disconnected';
  }
}
