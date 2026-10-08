import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { createHmac } from 'crypto';
import { RefreshPayload } from '@/modules/system/tokens/types/token.types';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { env } from '@/config/environment.config';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { UserCredentialsService } from '@/modules/domain/identity/services/user-credentials.service';
import { getRefreshCookieName } from '@/config/cookie.config';

@Injectable()
class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly userSvc: UserService,
    private readonly refreshSvc: RefreshService,
    private readonly credentials: UserCredentialsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.[getRefreshCookieName()] || null,
      ]),
      secretOrKey: env.REFRESH_SECRET_KEY,
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: RefreshPayload,
  ): Promise<{
    userEntity: UserEntity;
    sessionEntity: UserSessionEntity;
    refresh: string;
    email: string;
    sub: string;
    sid: string;
    version: number;
  }> {
    return this.validateRefresh(req, payload);
  }

  private async validateRefresh(
    req: Request,
    payload: RefreshPayload,
  ): Promise<{
    userEntity: UserEntity;
    sessionEntity: UserSessionEntity;
    refresh: string;
    email: string;
    sub: string;
    sid: string;
    version: number;
  }> {
    const refresh = req.cookies?.[getRefreshCookieName()];

    if (!refresh) throw new UnauthorizedException('Refresh token missing');

    const user = await this.userSvc.findByIdOrFail(payload.sub);

    if (!user) throw new NotFoundException('User was not found');

    this.credentials.assertCanAuthenticate(user);

    const session = await this.refreshSvc.findSessionById(user.id, payload.sid);

    if (!session?.active || !session.refresh)
      throw new UnauthorizedException('Session has been revoked');

    if (
      createHmac('sha256', env.CRYPTO_SECRET || '')
        .update(refresh)
        .digest('hex') !== session.refresh
    )
      throw new UnauthorizedException('Invalid refresh token');
    return { ...payload, userEntity: user, sessionEntity: session, refresh };
  }
}
export { RefreshTokenStrategy };
