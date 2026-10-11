import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { storageTrackingPolicy } from '@/config/storage-tracking.config';
import { StorageObjectEntity } from '../entities/storage-object.entity';

@Injectable()
export class StorageObjectRepository implements OnModuleDestroy {
  private reservationSource?: Promise<DataSource>;
  public constructor(private readonly source: DataSource) {}
  public get manager(): EntityManager {
    return this.source.manager;
  }

  /** Dedicated pool: reservations must commit even while request transactions occupy the application pool. */
  public async reservationManager(): Promise<EntityManager> {
    if (!this.reservationSource) {
      const source = new DataSource({
        ...this.source.options,
        entities: [StorageObjectEntity],
        migrations: [],
        subscribers: [],
        migrationsRun: false,
        synchronize: false,
        extra: {
          ...this.source.options.extra,
          connectionLimit: storageTrackingPolicy.reservationConnections,
          queueLimit: 0,
        },
      });
      this.reservationSource = source.initialize().catch((error: unknown) => {
        this.reservationSource = undefined;
        throw error;
      });
    }
    return (await this.reservationSource).manager;
  }
  public findLocked(
    manager: EntityManager,
    key: string,
  ): Promise<StorageObjectEntity | null> {
    return manager.getRepository(StorageObjectEntity).findOne({
      where: { storage_key: key },
      lock: { mode: 'pessimistic_write' },
    });
  }
  public findAbandoned(manager: EntityManager): Promise<StorageObjectEntity[]> {
    return manager
      .getRepository(StorageObjectEntity)
      .createQueryBuilder('object')
      .where('object.state IN (:...states)', {
        states: ['reserved', 'uploaded', 'deleted'],
      })
      .andWhere('object.expires_at <= :now', { now: new Date() })
      .orderBy('object.expires_at', 'ASC')
      .take(storageTrackingPolicy.batchSize)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getMany();
  }
  public async onModuleDestroy(): Promise<void> {
    if (this.reservationSource) await (await this.reservationSource).destroy();
  }
}
