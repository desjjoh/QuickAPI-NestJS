import { DataSource } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { DbStatus } from '../types/database.types';

@Injectable()
export class TypeOrmService {
  constructor(private readonly dataSource: DataSource) {}

  public async get_status(): Promise<DbStatus> {
    if (this.dataSource.isInitialized) return 'connected';

    return 'disconnected';
  }
}
