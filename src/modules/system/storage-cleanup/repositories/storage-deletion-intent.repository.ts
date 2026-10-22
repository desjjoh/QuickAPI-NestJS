import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { StorageDeletionIntentEntity } from '../entities/storage-deletion-intent.entity';

@Injectable()
export class StorageDeletionIntentRepository {
  private readonly persistence: Repository<StorageDeletionIntentEntity>;

  public constructor(source: DataSource) {
    this.persistence = source.getRepository(StorageDeletionIntentEntity);
  }

  public get manager(): EntityManager {
    return this.persistence.manager;
  }

  private getRepository(
    manager: EntityManager,
  ): Repository<StorageDeletionIntentEntity> {
    return manager.getRepository(StorageDeletionIntentEntity);
  }

  public findDue(
    manager: EntityManager,
  ): Promise<StorageDeletionIntentEntity[]> {
    return this.getRepository(manager)
      .createQueryBuilder('intent')
      .where('intent.available_at <= :now', { now: new Date() })
      .andWhere(
        '(intent.state = :pending OR (intent.state = :failed AND intent.dlq_forwarded = false))',
        {
          pending: 'pending',
          failed: 'failed',
        },
      )
      .orderBy('intent.available_at', 'ASC')
      .take(20)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getMany();
  }

  public findLocked(
    manager: EntityManager,
    id: string,
  ): Promise<StorageDeletionIntentEntity | null> {
    return this.getRepository(manager).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }
}
