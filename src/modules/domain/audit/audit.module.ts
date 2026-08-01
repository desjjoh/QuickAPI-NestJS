import { Module } from '@nestjs/common';

import { AuditRedactionService } from './services/audit-redaction.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEventEntity } from './entities/audit-event.entity';
import { AuditService } from './services/audit.service';
import { RequestContextModule } from '@/modules/system/context/context.module';
import { AuditPolicyRegistry } from './services/audit-policy.registry';
import { AuditRepository } from './repositories/audit.repository';
import { AuditQueryService } from './services/audit-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEventEntity]), RequestContextModule],
  providers: [
    AuditPolicyRegistry,
    AuditRedactionService,
    AuditService,
    AuditRepository,
    AuditQueryService,
  ],
  exports: [
    AuditPolicyRegistry,
    AuditRedactionService,
    AuditService,
    AuditQueryService,
  ],
})
export class AuditModule {}
