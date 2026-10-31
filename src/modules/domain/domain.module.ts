import { Module } from '@nestjs/common';
import { LibraryModule } from './library/library.module';
import { IdentityModule } from './identity/identity.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [LibraryModule, IdentityModule, AuditModule],
  exports: [LibraryModule, IdentityModule, AuditModule],
})
export class DomainModule {}
