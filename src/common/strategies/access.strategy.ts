import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { env } from '@/config/environment.config';
import { RefreshPayload } from '@/modules/system/tokens/types/token.types';

export interface AccessTokenValidationPayload {
  accessToken: string;
  userEntity: UserEntity;
  email: string;
  sub: string;
}

@Injectable()
class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(private userRepository: UserRepository) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET_KEY,
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: RefreshPayload,
  ): Promise<AccessTokenValidationPayload> {
    const accessToken = req
      .get('Authorization')
      ?.replace(/^Bearer\s+/i, '')
      ?.trim();
    if (!accessToken) throw new UnauthorizedException('Access token missing');

    const user = await this.userRepository.findByIdOrFail(payload.sub);

    if (payload.version !== user.credentials.token_version)
      throw new UnauthorizedException('Session has been revoked');

    return { ...payload, accessToken, userEntity: user };
  }
}

export { AccessTokenStrategy };
