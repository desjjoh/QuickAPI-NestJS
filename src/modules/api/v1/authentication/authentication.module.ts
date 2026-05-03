import { IdentityModule } from '@/modules/domain/identity/identity.module';
import { TokenModule } from '@/modules/system/tokens/token.module';
import { Module } from '@nestjs/common';
import { AuthApiController } from './controllers/authentication.controller';
import { AuthService } from './services/authentication.service';
import { LibraryModule } from '@/modules/domain/library/library.module';

@Module({
  imports: [IdentityModule, TokenModule, LibraryModule],
  providers: [AuthService],
  controllers: [AuthApiController],
})
export class AuthenticationApiModule {}
