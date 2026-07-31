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
import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { getRefreshCookieName } from '@/config/cookie.config';

@Injectable()
class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly repo: UserRepository,
    private readonly svc: UserService,
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

    const user = await this.repo.findByIdOrFail(payload.sub);

    if (!user) throw new NotFoundException('User was not found');

    this.svc.assertCanAuthenticate(user);

    const session = await this.repo.manager.findOne(UserSessionEntity, {
      where: { id: payload.sid, user: { id: user.id } },
    });

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
