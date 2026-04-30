import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from './entities/user.entity';
import { UserProfileEntity } from './entities/profile.entity';
import { UserCredentialsEntity } from './entities/credentials.entity';
import { UserAddressEntity } from './entities/address.entity';
import { TokenModule } from '@/modules/system/tokens/token.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      UserProfileEntity,
      UserAddressEntity,
      UserCredentialsEntity,
    ]),
    TokenModule,
  ],
})
export class IdentityModule {}
