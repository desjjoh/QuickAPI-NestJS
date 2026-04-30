import { IdentityModule } from '@/modules/domain/identity/identity.module';
import { TokenModule } from '@/modules/system/tokens/token.module';
import { Module } from '@nestjs/common';
import { AuthApiController } from './controllers/authentication.controller';
import { IdentityService } from '@/modules/domain/identity/services/identity.service';
import { AuthService } from './services/authentication.service';
import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import { LibraryModule } from '@/modules/domain/library/library.module';

@Module({
  imports: [IdentityModule, TokenModule, LibraryModule],
  providers: [UserRepository, AuthService, IdentityService],
  controllers: [AuthApiController],
})
export class AuthenticationApiModule {}
