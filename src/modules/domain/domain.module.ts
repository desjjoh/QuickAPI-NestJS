import { Module } from '@nestjs/common';
import { LibraryModule } from './library/library.module';
import { IdentityModule } from './identity/identity.module';
import { AuditModule } from './audit/audit.module';
import { ArticlesModule } from './articles/articles.module';

@Module({
  imports: [LibraryModule, IdentityModule, AuditModule, ArticlesModule],
  exports: [LibraryModule, IdentityModule, AuditModule, ArticlesModule],
})
export class DomainModule {}
