import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, QueryRunner, Repository } from 'typeorm';
import { IdempotencyEntity } from '../entities/idempotency.entity';

@Injectable()
export class IdempotencyRepository {
  private readonly persistence: Repository<IdempotencyEntity>;

  public constructor(dataSource: DataSource) {
    this.persistence = dataSource.getRepository(IdempotencyEntity);
  }

  public get manager(): EntityManager {
    return this.persistence.manager;
  }

  public get namespace(): string {
    return String(this.manager.connection.options.database);
  }

  public createQueryRunner(): QueryRunner {
    return this.manager.connection.createQueryRunner();
  }

  public findByScope(
    manager: EntityManager,
    scopeHash: string,
  ): Promise<IdempotencyEntity | null> {
    return manager.getRepository(IdempotencyEntity).findOne({
      where: { scope_hash: scopeHash },
      lock: { mode: 'pessimistic_write' },
    });
  }
}
