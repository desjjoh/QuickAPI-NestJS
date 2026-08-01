import { IdentityModule } from '@/modules/domain/identity/identity.module';
import { Module } from '@nestjs/common';
import { UserAdministrationController } from './controllers/users.controller';
import { UserAdminService } from './service/users.service';
import { AuditModule } from '@/modules/domain/audit/audit.module';
import { UserActivityAdminService } from './service/user-activity.service';

@Module({
  imports: [IdentityModule, AuditModule],
  providers: [UserAdminService, UserActivityAdminService],
  controllers: [UserAdministrationController],
})
export class AdministrationApiModule {}
