import { IdentityModule } from '@/modules/domain/identity/identity.module';
import { TokenModule } from '@/modules/system/tokens/token.module';
import { Module } from '@nestjs/common';

import { AuthApiController } from './controllers/authentication.controller';
import { RegistrationApiController } from './controllers/registration.controller';
import { PasswordResetApiController } from './controllers/password-reset.controller';
import { EmailVerificationApiController } from './controllers/email-verification.controller';

import { AuthService } from './services/authentication.service';
import { LibraryModule } from '@/modules/domain/library/library.module';

@Module({
  imports: [IdentityModule, TokenModule, LibraryModule],
  providers: [AuthService],
  controllers: [
    AuthApiController,
    RegistrationApiController,
    PasswordResetApiController,
    EmailVerificationApiController,
  ],
})
export class AuthenticationApiModule {}
