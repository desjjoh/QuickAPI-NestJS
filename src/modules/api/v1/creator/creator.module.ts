import { Module } from '@nestjs/common';

import { ArticlesModule } from '@/modules/domain/articles/articles.module';
import { AuditModule } from '@/modules/domain/audit/audit.module';
import { TokenModule } from '@/modules/system/tokens/token.module';
import { IdempotencyModule } from '@/modules/system/idempotency/idempotency.module';
import { CreatorArticleController } from './articles/controllers/articles.controller';
import { CreatorArticleApiService } from './articles/services/articles.service';

@Module({
  imports: [ArticlesModule, AuditModule, TokenModule, IdempotencyModule],
  controllers: [CreatorArticleController],
  providers: [CreatorArticleApiService],
})
export class CreatorApiModule {}
