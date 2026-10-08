import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { ArticleStatusEntity } from '../entities/articleStatus.entity';

@Injectable()
export class ArticleStatusRepository extends Repository<ArticleStatusEntity> {
  public constructor(dataSource: DataSource) {
    super(ArticleStatusEntity, dataSource.createEntityManager());
  }

  public async findAll(): Promise<ArticleStatusEntity[]> {
    return this.find({ order: { key: 'ASC' } });
  }

  public async findById(id: string): Promise<ArticleStatusEntity | null> {
    return this.findOne({ where: { id } });
  }

  public async findByKey(key: string): Promise<ArticleStatusEntity | null> {
    return this.findOne({ where: { key } });
  }
}
