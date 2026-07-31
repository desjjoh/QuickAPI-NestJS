import { Module } from '@nestjs/common';

import { AuditRedactionService } from './services/audit-redaction.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEventEntity } from './entities/audit-event.entity';
import { AuditService } from './services/audit.service';
import { RequestContextModule } from '@/modules/system/context/context.module';
import { AuditPolicyRegistry } from './services/audit-policy.registry';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEventEntity]), RequestContextModule],
  providers: [AuditPolicyRegistry, AuditRedactionService, AuditService],
  exports: [AuditPolicyRegistry, AuditRedactionService, AuditService],
})
export class AuditModule {}
