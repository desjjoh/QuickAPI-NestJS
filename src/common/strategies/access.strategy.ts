import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { env } from '@/config/environment.config';
import { RefreshPayload } from '@/modules/system/tokens/types/token.types';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';

export interface AccessTokenValidationPayload {
  accessToken: string;
  userEntity: UserEntity;
  sessionEntity: UserSessionEntity;
  email: string;
  sub: string;
  sid: string;
  version: number;
}

@Injectable()
class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(private readonly repo: UserRepository) {
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

    const user = await this.repo.findByIdOrFail(payload.sub);
    const session = await this.repo.manager.findOne(UserSessionEntity, {
      where: { id: payload.sid, user: { id: user.id } },
    });

    if (!session?.active || payload.version !== session.token_version)
      throw new UnauthorizedException('Session has been revoked');

    return {
      ...payload,
      accessToken,
      userEntity: user,
      sessionEntity: session,
    };
  }
}

export { AccessTokenStrategy };
