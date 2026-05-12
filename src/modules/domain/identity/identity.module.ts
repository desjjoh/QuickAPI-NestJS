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

import { LibraryModule } from '../library/library.module';
import { RefreshService } from './services/refresh.service';
import { EmailVerificationService } from './services/email-verification.service';
import { EmailModule } from '@/modules/system/email/email.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      UserProfileEntity,
      UserAddressEntity,
      UserCredentialsEntity,
      AccountTokenEntity,
    ]),
    TokenModule,
    LibraryModule,
    EmailModule,
  ],
  providers: [
    UserRepository,
    UserService,
    RefreshService,
    AccountTokenService,
    EmailVerificationService,
  ],
  exports: [
    UserRepository,
    UserService,
    RefreshService,
    AccountTokenService,
    EmailVerificationService,
  ],
})
export class IdentityModule {}
