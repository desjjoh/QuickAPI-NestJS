import { Module } from '@nestjs/common';
import { ArticlesModule } from '@/modules/domain/articles/articles.module';
import { AuditModule } from '@/modules/domain/audit/audit.module';
import { TokenModule } from '@/modules/system/tokens/token.module';
import { IdempotencyModule } from '@/modules/system/idempotency/idempotency.module';
import { AuthoringArticleController } from './controllers/authoring-articles.controller';
import { AuthoringArticleApiService } from './services/authoring-articles.service';

@Module({
  imports: [ArticlesModule, AuditModule, TokenModule, IdempotencyModule],
  controllers: [AuthoringArticleController],
  providers: [AuthoringArticleApiService],
})
export class ArticlesApiModule {}
