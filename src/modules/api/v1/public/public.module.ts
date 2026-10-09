import { Module } from '@nestjs/common';

import { ArticlesModule } from '@/modules/domain/articles/articles.module';
import { PublicArticleController } from './articles/controllers/articles.controller';
import { PublicArticleApiService } from './articles/services/articles.service';

@Module({
  imports: [ArticlesModule],
  controllers: [PublicArticleController],
  providers: [PublicArticleApiService],
})
export class PublicApiModule {}
