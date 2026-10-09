import { IdentityModule } from '@/modules/domain/identity/identity.module';
import { Module } from '@nestjs/common';
import { UserAdministrationController } from './controllers/users.controller';
import { UserAdminService } from './service/users.service';
import { AuditModule } from '@/modules/domain/audit/audit.module';
import { UserActivityAdminService } from './service/user-activity.service';
import { AuditAdministrationController } from './controllers/audit.controller';
import { AuditAdministrationService } from './service/audit.service';
import { ArticlesModule } from '@/modules/domain/articles/articles.module';
import { ArticleAdministrationController } from './controllers/articles.controller';
import { ArticleAdministrationApiService } from './service/articles.service';
import { TokenModule } from '@/modules/system/tokens/token.module';

@Module({
  imports: [IdentityModule, AuditModule, ArticlesModule, TokenModule],
  providers: [
    UserAdminService,
    UserActivityAdminService,
    AuditAdministrationService,
    ArticleAdministrationApiService,
  ],
  controllers: [
    UserAdministrationController,
    AuditAdministrationController,
    ArticleAdministrationController,
  ],
})
export class AdministrationApiModule {}
