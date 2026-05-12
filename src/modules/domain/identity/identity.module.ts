import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TokenModule } from '@/modules/system/tokens/token.module';

import { UserEntity } from './entities/user.entity';
import { UserProfileEntity } from './entities/profile.entity';
import { UserCredentialsEntity } from './entities/credentials.entity';
import { UserAddressEntity } from './entities/address.entity';
import { UserRepository } from './repositories/user.repository';
import { IdentityService } from './services/identity.service';
import { AccountTokenEntity } from './entities/account-token.entity';
import { AccountTokenService } from './services/token.service';

import { LibraryModule } from '../library/library.module';
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
  ],
  providers: [UserRepository, IdentityService, AccountTokenService],
  exports: [UserRepository, IdentityService, AccountTokenService],
})
export class IdentityModule {}
