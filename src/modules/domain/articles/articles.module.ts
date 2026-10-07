import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SeedingModule } from '@/modules/system/seeder/seeder.module';

import { ArticleStatusSeeder } from './seeders/status.seeder';
import { ArticleStatusEntity } from './entities/articleStatus.entity';
import { ArticleEntity } from './entities/article.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ArticleEntity, ArticleStatusEntity]),
    SeedingModule.forFeature([new ArticleStatusSeeder()]),
  ],
  providers: [],
  exports: [],
})
export class ArticlesModule {}
