import { Module } from '@nestjs/common';
import { MeApiController } from './controllers/me.controller';
import { TokenModule } from '@/modules/system/tokens/token.module';
import { IdentityModule } from '@/modules/domain/identity/identity.module';
import { MeApiService } from './services/me.service';
import { ProfileApiController } from './controllers/profile.controller';
import { ProfileApiService } from './services/profile.service';
import { LibraryModule } from '@/modules/domain/library/library.module';

@Module({
  imports: [TokenModule, IdentityModule, LibraryModule],
  providers: [MeApiService, ProfileApiService],
  controllers: [MeApiController, ProfileApiController],
})
export class AccountApiModule {}
