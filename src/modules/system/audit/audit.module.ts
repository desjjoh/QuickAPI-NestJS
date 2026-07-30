import { Module } from '@nestjs/common';

import { AuditRedactionService } from './services/audit-redaction.service';

@Module({
  providers: [AuditRedactionService],
  exports: [AuditRedactionService],
})
export class AuditModule {}
