import { Injectable, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import {
  getClearRefreshCookieOptions,
  getRefreshCookieName,
  getRefreshCookieOptions,
} from '@/config/cookie.config';
import { TokenService } from '@/modules/system/tokens/services/token.service';
import { RequestContext } from '@/common/store/request-context.store';
import { JWTDto } from '../models/jwt.model';
import { UserEntity } from '../entities/user.entity';
import { UserSessionEntity } from '../entities/session.entity';
import { UserRepository } from '../repositories/user.repository';
import {
  createSessionInfoFromRequest,
  SessionInfo,
} from '@/common/helpers/session-info.helper';
import { IpLocationService } from '@/modules/system/geolocation/services/ip-location.service';
import { MoreThan, Not, IsNull } from 'typeorm';
import { day } from '@/common/constants/milliseconds.constants';
import { env } from '@/config/environment.config';

@Injectable()
export class RefreshService {
  public constructor(
    private readonly tokenSvc: TokenService,
    private readonly userRepo: UserRepository,
    private readonly requestContext: RequestContext,
    private readonly ipLocation: IpLocationService,
  ) {}

  public async issueTokens(
    user: UserEntity,
    res: Response,
    existingSession?: UserSessionEntity,
  ): Promise<JWTDto> {
    const currentSession = (
      this.requestContext.get('request')?.user as
        | { sessionEntity?: UserSessionEntity }
        | undefined
    )?.sessionEntity;

    const session =
      existingSession ?? currentSession ?? (await this.createSession(user));

    const rotatedSession = await this.rotateSession(session);
    const tokens = await this.tokenSvc.createTokenPair({
      sub: user.id,
      email: user.identity.email,
      version: rotatedSession.token_version,
      sid: rotatedSession.id,
    });

    const updatedSession = await this.updateSession(
      rotatedSession,
      this.tokenSvc.hashToken(tokens.refresh_token),
    );

    const accessToken = this.tokenSvc.decode(tokens.access_token);
    const refreshToken = this.tokenSvc.decode(tokens.refresh_token);

    res.cookie(
      getRefreshCookieName(),
      tokens.refresh_token,
      getRefreshCookieOptions(),
    );

    return new JWTDto({
      refresh: refreshToken.exp,
      access_token: tokens.access_token,
      iat: accessToken.iat,
      exp: accessToken.exp,
      user,
      session: updatedSession,
    });
  }

  public async revokeTokens(
    session: UserSessionEntity,
    res: Response,
  ): Promise<void> {
    await this.revokeSession(session);
    res.clearCookie(getRefreshCookieName(), getClearRefreshCookieOptions());
  }

  public async revokeSession(session: UserSessionEntity): Promise<void> {
    await this.userRepo.manager.update(UserSessionEntity, session.id, {
      active: false,
      refresh: null,
    });
  }

  public async revokeAllSessions(userId: string, res: Response): Promise<void> {
    await this.userRepo.revokeAllSessions(userId);
    res.clearCookie(getRefreshCookieName(), getClearRefreshCookieOptions());
  }

  public async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<void> {
    await this.userRepo.manager
      .createQueryBuilder()
      .update(UserSessionEntity)
      .set({ active: false, refresh: null })
      .where('userId = :userId AND id != :currentSessionId AND active = true', {
        userId,
        currentSessionId,
      })
      .execute();
  }

  public async findSessions(userId: string): Promise<UserSessionEntity[]> {
    const refreshTokenNotExpiredAfter = new Date(
      Date.now() - env.REFRESH_COOKIE_MAX_AGE_DAYS * day,
    );

    return this.userRepo.manager.find(UserSessionEntity, {
      where: {
        user: { id: userId },
        active: true,
        refresh: Not(IsNull()),
        updatedAt: MoreThan(refreshTokenNotExpiredAfter),
      },
      order: { createdAt: 'DESC' },
    });
  }

  public async revokeSessionById(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const session = await this.userRepo.manager.findOne(UserSessionEntity, {
      where: { id: sessionId, user: { id: userId } },
    });
    if (!session) throw new NotFoundException('Session not found.');
    await this.revokeSession(session);
  }

  private async createSession(user: UserEntity): Promise<UserSessionEntity> {
    const req = this.requestContext.get('request');
    const info: SessionInfo | null = createSessionInfoFromRequest(req);
    const location = req ? await this.ipLocation.resolve(req) : null;
    return this.userRepo.manager.save(
      UserSessionEntity,
      this.userRepo.manager.create(UserSessionEntity, {
        user,
        refresh: null,
        token_version: 0,
        active: true,
        ...(info
          ? {
              browser: info.browser,
              browser_version: info.browser_version,
              device: info.device,
              os: info.os,
              os_version: info.os_version,
              ip_address: info.ip_address,
              user_agent: info.user_agent,
              origin: info.origin,
              location: {
                country_code: location?.countryCode ?? null,
                country_name: location?.countryName ?? null,
                region_code: location?.regionCode ?? null,
                region_name: location?.regionName ?? null,
                city: location?.city ?? null,
                source: location?.source ?? null,
                resolved_at: location?.resolvedAt ?? null,
              },
            }
          : {}),
      }),
    );
  }

  private async rotateSession(
    session: UserSessionEntity,
  ): Promise<UserSessionEntity> {
    return this.userRepo.manager.save(UserSessionEntity, {
      ...session,
      token_version: session.token_version + 1,
    });
  }

  private async updateSession(
    session: UserSessionEntity,
    refresh: string,
  ): Promise<UserSessionEntity> {
    return this.userRepo.manager.save(UserSessionEntity, {
      ...session,
      refresh,
    });
  }
}
