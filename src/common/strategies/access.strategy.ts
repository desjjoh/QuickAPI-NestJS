import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { env } from '@/config/environment.config';
import { RefreshPayload } from '@/modules/system/tokens/types/token.types';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';

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
  constructor(
    private readonly userSvc: UserService,
    private readonly refreshSvc: RefreshService,
  ) {
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

    const user = await this.userSvc.findByIdOrFail(payload.sub);
    const session = await this.refreshSvc.findSessionById(user.id, payload.sid);

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
