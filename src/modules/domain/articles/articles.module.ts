import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ArticleEntity } from './entities/article.entity';
import { ArticleStatusEntity } from './entities/publicationStatus.entity';
import { SeedingModule } from '@/modules/system/seeder/seeder.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ArticleEntity, ArticleStatusEntity]),
    SeedingModule.forFeature([]),
  ],
  providers: [],
  exports: [],
})
export class ArticlesModule {}
