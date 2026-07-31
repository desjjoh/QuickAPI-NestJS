import { IdentityModule } from '@/modules/domain/identity/identity.module';
import { TokenModule } from '@/modules/system/tokens/token.module';
import { Module } from '@nestjs/common';

import { AuthApiController } from './controllers/authentication.controller';
import { RegistrationApiController } from './controllers/registration.controller';
import { PasswordResetApiController } from './controllers/password-reset.controller';

import { AuthService } from './services/authentication.service';
import { LibraryModule } from '@/modules/domain/library/library.module';
import { RegistrationService } from './services/registration.service';
import { AuditModule } from '@/modules/domain/audit/audit.module';
import { PasswordResetService } from './services/password-reset.service';
import { EmailModule } from '@/modules/system/email/email.module';
import { AccountApiModule } from '../account/account.module';

@Module({
  imports: [
    IdentityModule,
    TokenModule,
    LibraryModule,
    AuditModule,
    EmailModule,
    AccountApiModule,
  ],
  providers: [AuthService, RegistrationService, PasswordResetService],
  controllers: [
    AuthApiController,
    RegistrationApiController,
    PasswordResetApiController,
  ],
})
export class AuthenticationApiModule {}
