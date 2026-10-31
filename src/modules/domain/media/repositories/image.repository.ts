import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { MutableDomainRepository } from '@/common/repositories/domain.repository';

import { ImageEntity } from '../entities/image.entity';

@Injectable()
export class ImageRepository extends MutableDomainRepository<ImageEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(ImageEntity));
  }

  public findAll(manager: EntityManager): Promise<ImageEntity[]> {
    return this.getRepository(manager).find({
      order: { createdAt: 'DESC' },
    });
  }

  public findByStorageKey(
    manager: EntityManager,
    storageKey: string,
  ): Promise<ImageEntity | null> {
    return this.getRepository(manager).findOne({
      where: { storage_key: storageKey },
    });
  }
}
