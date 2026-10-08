import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ReferenceRepository } from '@/common/repositories/reference.repository';

import { ArticleStatusEntity } from '../entities/articleStatus.entity';

@Injectable()
export class ArticleStatusRepository extends ReferenceRepository<ArticleStatusEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(ArticleStatusEntity));
  }
}
