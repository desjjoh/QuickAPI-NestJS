import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from './entities/user.entity';
import { UserProfileEntity } from './entities/profile.entity';
import { UserCredentialsEntity } from './entities/credentials.entity';
import { UserAddressEntity } from './entities/address.entity';
import { TokenModule } from '@/modules/system/tokens/token.module';
import { UserRepository } from './repositories/user.repository';
import { IdentityService } from './services/identity.service';
import { LibraryModule } from '../library/library.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      UserProfileEntity,
      UserAddressEntity,
      UserCredentialsEntity,
    ]),
    TokenModule,
    LibraryModule,
  ],
  providers: [UserRepository, IdentityService],
  exports: [UserRepository, IdentityService],
})
export class IdentityModule {}
