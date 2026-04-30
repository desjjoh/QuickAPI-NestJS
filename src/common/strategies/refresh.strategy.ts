import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { createHmac } from 'crypto';
import { RefreshPayload } from '@/modules/system/tokens/types/token.types';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { env } from '@/config/environment.config';
import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';

@Injectable()
class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly repo: UserRepository) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return req?.cookies?.['refresh_token'] || null;
        },
      ]),
      secretOrKey: env.REFRESH_SECRET_KEY,
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: RefreshPayload,
  ): Promise<{
    user: UserEntity;
    refresh: string;
    email: string;
    sub: string;
  }> {
    const refresh = req.cookies?.['refresh_token'];
    if (!refresh) throw new UnauthorizedException('Refresh token missing');

    const user = await this.repo.findByEmail(payload.email);

    if (!user?.credentials.refresh)
      throw new UnauthorizedException('No refresh token stored');

    if (payload.version !== user.credentials.token_version)
      throw new UnauthorizedException('Session has been revoked');

    const hmac = createHmac('sha256', env.CRYPTO_SECRET || '');
    const hash = hmac.update(refresh).digest('hex');

    if (hash !== user.credentials.refresh)
      throw new UnauthorizedException('Invalid refresh token');

    return { ...payload, user: user, refresh };
  }
}

export { RefreshTokenStrategy };
