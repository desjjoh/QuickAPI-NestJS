import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SeedingModule } from '@/modules/system/seeder/seeder.module';

import { ArticleStatusSeeder } from './seeders/status.seeder';
import { ArticleStatusEntity } from './entities/articleStatus.entity';
import { ArticleEntity } from './entities/article.entity';
import { ArticleRepository } from './repositories/article.repository';
import { ArticleStatusRepository } from './repositories/status.repository';
import { ArticleService } from './services/article.service';
import { IdentityModule } from '../identity/identity.module';
import { MediaModule } from '../media/media.module';
import { ArticleStatusTransitionPolicy } from './policies/article-status-transition.policy';

@Module({
  imports: [
    TypeOrmModule.forFeature([ArticleEntity, ArticleStatusEntity]),
    SeedingModule.forFeature([new ArticleStatusSeeder()]),
    IdentityModule,
    MediaModule,
  ],
  providers: [
    ArticleRepository,
    ArticleStatusRepository,
    ArticleStatusTransitionPolicy,
    ArticleService,
  ],
  exports: [ArticleService],
})
export class ArticlesModule {}
