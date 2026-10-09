import { Module } from '@nestjs/common';

import { ArticlesModule } from '@/modules/domain/articles/articles.module';
import { AuditModule } from '@/modules/domain/audit/audit.module';
import { TokenModule } from '@/modules/system/tokens/token.module';

import { PublicArticleController } from './controllers/articles.controller';
import { CreatorArticleController } from './controllers/creator-articles.controller';
import { PublicArticleApiService } from './services/articles.service';
import { CreatorArticleApiService } from './services/creator-articles.service';

@Module({
  imports: [ArticlesModule, AuditModule, TokenModule],
  controllers: [CreatorArticleController, PublicArticleController],
  providers: [PublicArticleApiService, CreatorArticleApiService],
})
export class ArticlesApiModule {}
