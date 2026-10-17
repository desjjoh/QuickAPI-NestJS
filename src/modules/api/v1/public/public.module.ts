import { Module } from '@nestjs/common';
import { LibraryController } from './controllers/library.controller';
import { LibraryModule } from '@/modules/domain/library/library.module';
import { IdentityModule } from '@/modules/domain/identity/identity.module';
import { LibraryService } from './services/library.service';
import { ArticlesModule } from '@/modules/domain/articles/articles.module';
import { PublicArticleController } from './controllers/public-articles.controller';
import { PublicArticleApiService } from './services/public-articles.service';

@Module({
  imports: [LibraryModule, IdentityModule, ArticlesModule],
  providers: [LibraryService, PublicArticleApiService],
  controllers: [LibraryController, PublicArticleController],
})
export class PublicApiModule {}
