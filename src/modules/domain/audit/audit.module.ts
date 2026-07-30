import { Module } from '@nestjs/common';

import { AuditRedactionService } from './services/audit-redaction.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEventEntity } from './entities/audit-event.entity';
import { AuditService } from './services/audit.service';
import { RequestContextModule } from '@/modules/system/context/context.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEventEntity]), RequestContextModule],
  providers: [AuditRedactionService, AuditService],
  exports: [AuditRedactionService, AuditService],
})
export class AuditModule {}
