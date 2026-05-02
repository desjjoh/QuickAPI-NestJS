import { Module } from '@nestjs/common';
import { SecurityApiService } from './services/security.service';
import { SecurityApiController } from './controllers/security.controller';
import { TokenModule } from '@/modules/system/tokens/token.module';

@Module({
  imports: [TokenModule],
  providers: [SecurityApiService],
  controllers: [SecurityApiController],
})
export class SecurityApiModule {}
