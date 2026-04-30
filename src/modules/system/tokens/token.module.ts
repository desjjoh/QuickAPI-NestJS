import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';

import { env } from '@/config/environment.config';

import { TokenService } from './services/token.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [
    {
      provide: TokenService,
      useFactory: (jwtService: JwtService): TokenService => {
        return new TokenService(jwtService, {
          jwtSecret: env.JWT_SECRET_KEY,
          jwtExpiryTime: env.JWT_EXPIRY_TIME,
          refreshSecret: env.REFRESH_SECRET_KEY,
          refreshExpiryTime: env.REFRESH_EXPIRY_TIME,
          cryptoSecret: env.CRYPTO_SECRET,
        });
      },
      inject: [JwtService],
    },
  ],
  exports: [TokenService],
})
export class TokenModule {}
