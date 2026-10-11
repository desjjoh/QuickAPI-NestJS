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

  /** Call only while holding the connection-scoped advisory lock for this scope. */
  public findByScope(
    manager: EntityManager,
    scopeHash: string,
  ): Promise<IdempotencyEntity | null> {
    // FOR UPDATE on an absent key takes a gap lock under REPEATABLE READ;
    // unrelated new scopes can then deadlock when inserting their claims.
    return manager.getRepository(IdempotencyEntity).findOne({
      where: { scope_hash: scopeHash },
    });
  }
}
