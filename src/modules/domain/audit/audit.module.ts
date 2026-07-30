import { Module } from '@nestjs/common';

import { AuditRedactionService } from './services/audit-redaction.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityAuditEntity } from './entities/activity-audit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityAuditEntity])],
  providers: [AuditRedactionService],
  exports: [AuditRedactionService],
})
export class AuditModule {}
