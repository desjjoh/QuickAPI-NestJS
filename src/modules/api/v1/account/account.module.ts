import { Module } from '@nestjs/common';
import { MeApiController } from './controllers/me.controller';
import { TokenModule } from '@/modules/system/tokens/token.module';
import { IdentityModule } from '@/modules/domain/identity/identity.module';
import { MeApiService } from './services/me.service';
import { ProfileApiController } from './controllers/profile.controller';
import { ProfileApiService } from './services/profile.service';
import { LibraryModule } from '@/modules/domain/library/library.module';
import { MediaModule } from '@/modules/domain/media/media.module';
import { SessionsApiController } from './controllers/session.controller';
import { SessionsApiService } from './services/sessions.service';
import { EmailModule } from '@/modules/system/email/email.module';

@Module({
  imports: [
    TokenModule,
    IdentityModule,
    LibraryModule,
    MediaModule,
    EmailModule,
  ],
  providers: [MeApiService, ProfileApiService, SessionsApiService],
  controllers: [MeApiController, ProfileApiController, SessionsApiController],
})
export class AccountApiModule {}
