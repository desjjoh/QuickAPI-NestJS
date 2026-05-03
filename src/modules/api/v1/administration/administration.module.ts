import { IdentityModule } from '@/modules/domain/identity/identity.module';
import { Module } from '@nestjs/common';
import { UserAdministrationController } from './controllers/users.controller';
import { UserAdminService } from './service/users.service';

@Module({
  imports: [IdentityModule],
  providers: [UserAdminService],
  controllers: [UserAdministrationController],
})
export class AdministrationApiModule {}
