import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { ProfileEntity } from './entities/profile.entity';
import { AddressEntity } from './entities/address.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, ProfileEntity, AddressEntity]),
  ],
})
export class IdentityModule {}
