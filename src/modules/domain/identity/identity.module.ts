import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TokenModule } from '@/modules/system/tokens/token.module';

import { UserEntity } from './entities/user.entity';
import { UserProfileEntity } from './entities/profile.entity';
import { UserCredentialsEntity } from './entities/credentials.entity';
import { UserAddressEntity } from './entities/address.entity';
import { UserRepository } from './repositories/user.repository';
import { UserService } from './services/user.service';
import { AccountTokenEntity } from './entities/account-token.entity';
import { AccountTokenService } from './services/token.service';
import { RegistrationTokenEntity } from './entities/registration-token.entity';

import { LibraryModule } from '../library/library.module';
import { RefreshService } from './services/refresh.service';
import { EmailVerificationService } from './services/email-verification.service';
import { EmailModule } from '@/modules/system/email/email.module';
import { PasswordResetService } from './services/password-reset.service';
import { MediaModule } from '../media/media.module';
import {
  UserAlternatePhoneEntity,
  UserPhoneEntity,
} from './entities/phone.entity';
import { RegistrationTokenService } from './services/registration-token.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      UserProfileEntity,
      UserAddressEntity,
      UserPhoneEntity,
      UserAlternatePhoneEntity,
      UserCredentialsEntity,
      AccountTokenEntity,
      RegistrationTokenEntity,
    ]),
    TokenModule,
    LibraryModule,
    MediaModule,
    EmailModule,
  ],
  providers: [
    UserRepository,
    UserService,
    RefreshService,
    AccountTokenService,
    EmailVerificationService,
    RegistrationTokenService,
    PasswordResetService,
  ],
  exports: [
    UserRepository,
    UserService,
    RefreshService,
    AccountTokenService,
    RegistrationTokenService,
    EmailVerificationService,
    PasswordResetService,
  ],
})
export class IdentityModule {}
