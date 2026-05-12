import { Module } from '@nestjs/common';
import { SecurityApiService } from './services/security.service';
import { SecurityApiController } from './controllers/security.controller';
import { TokenModule } from '@/modules/system/tokens/token.module';
import { IdentityModule } from '@/modules/domain/identity/identity.module';

@Module({
  imports: [TokenModule, IdentityModule],
  providers: [SecurityApiService],
  controllers: [SecurityApiController],
})
export class SecurityApiModule {}
