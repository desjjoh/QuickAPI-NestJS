import { Module } from '@nestjs/common';
import { MeApiController } from './controllers/me.controller';
import { TokenModule } from '@/modules/system/tokens/token.module';
import { IdentityModule } from '@/modules/domain/identity/identity.module';
import { MeApiService } from './services/me.service';
import { ProfileApiController } from './controllers/profile.controller';

@Module({
  imports: [TokenModule, IdentityModule],
  providers: [MeApiService],
  controllers: [MeApiController, ProfileApiController],
})
export class AccountApiModule {}
