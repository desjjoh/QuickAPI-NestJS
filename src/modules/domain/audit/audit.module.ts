import { Module } from '@nestjs/common';

import { AuditRedactionService } from './services/audit-redaction.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityAuditEntity } from './entities/activity-audit.entity';
import { ActivityAuditService } from './services/activity-audit.service';
import { RequestContextModule } from '@/modules/system/context/context.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActivityAuditEntity]),
    RequestContextModule,
  ],
  providers: [AuditRedactionService, ActivityAuditService],
  exports: [AuditRedactionService, ActivityAuditService],
})
export class AuditModule {}
