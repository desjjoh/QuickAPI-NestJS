import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { DomainRepository } from '@/common/repositories/domain.repository';

import { ArticleEntity } from '../entities/article.entity';

@Injectable()
export class ArticleRepository extends DomainRepository<ArticleEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(ArticleEntity));
  }

  public findAll(manager: EntityManager): Promise<ArticleEntity[]> {
    return this.getRepository(manager).find({
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  public findByStatusKey(
    manager: EntityManager,
    statusKey: string,
  ): Promise<ArticleEntity[]> {
    return this.getRepository(manager).find({
      where: { publication: { status: { key: statusKey } } },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  public findByAuthorId(
    manager: EntityManager,
    authorId: string,
  ): Promise<ArticleEntity[]> {
    return this.getRepository(manager).find({
      where: { attribution: { author: { id: authorId } } },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }
}
