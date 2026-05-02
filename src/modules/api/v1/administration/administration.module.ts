import { IdentityModule } from '@/modules/domain/identity/identity.module';
import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import { Module } from '@nestjs/common';
import { UserAdministrationController } from './controllers/users.controller';

@Module({
  imports: [IdentityModule],
  providers: [UserRepository],
  controllers: [UserAdministrationController],
})
export class AdministrationApiModule {}
