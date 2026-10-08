import { Injectable, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';

import {
  getClearRefreshCookieOptions,
  getRefreshCookieName,
  getRefreshCookieOptions,
} from '@/config/cookie.config';
import { TokenService } from '@/modules/system/tokens/services/token.service';
import { RequestContext } from '@/common/store/request-context.store';
import { createSessionInfoFromRequest } from '@/common/helpers/session-info.helper';
import { IpLocationService } from '@/modules/system/geolocation/services/ip-location.service';
import { day } from '@/common/constants/milliseconds.constants';
import { env } from '@/config/environment.config';

import { JWTDto } from '../models/jwt.model';
import { UserEntity } from '../entities/user.entity';
import { UserSessionEntity } from '../entities/session.entity';
import { SessionRepository } from '../repositories/session.repository';

@Injectable()
export class RefreshService {
  public constructor(
    private readonly tokenSvc: TokenService,
    private readonly sessionRepo: SessionRepository,
    private readonly requestContext: RequestContext,
    private readonly ipLocation: IpLocationService,
  ) {}

  public async issueTokens(
    user: UserEntity,
    res: Response,
    existingSession?: UserSessionEntity,
    req?: Request,
    manager: EntityManager = this.sessionRepo.manager,
  ): Promise<JWTDto> {
    const contextSessionId = this.requestContext.get('sessionId');
    const currentSession = contextSessionId
      ? await this.sessionRepo.findByUser(manager, user.id, contextSessionId)
      : null;
    const session =
      existingSession ??
      currentSession ??
      (await this.createSession(user, req, manager));
    const rotatedSession = await this.rotateSession(session, manager);
    const tokens = await this.tokenSvc.createTokenPair({
      sub: user.id,
      email: user.identity.email,
      version: rotatedSession.token_version,
      sid: rotatedSession.id,
    });
    const updatedSession = await this.updateSession(
      rotatedSession,
      this.tokenSvc.hashToken(tokens.refresh_token),
      manager,
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

  public async revokeSession(
    session: UserSessionEntity,
    manager: EntityManager = this.sessionRepo.manager,
  ): Promise<void> {
    await manager.update(UserSessionEntity, session.id, {
      active: false,
      refresh: null,
    });
  }

  public async revokeAllSessions(
    userId: string,
    res?: Response,
    manager: EntityManager = this.sessionRepo.manager,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(UserSessionEntity)
      .set({ active: false, refresh: null })
      .where('userId = :userId AND active = true', { userId })
      .execute();

    res?.clearCookie(getRefreshCookieName(), getClearRefreshCookieOptions());
  }

  public async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
    manager: EntityManager = this.sessionRepo.manager,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(UserSessionEntity)
      .set({ active: false, refresh: null })
      .where('userId = :userId AND id != :currentSessionId AND active = true', {
        userId,
        currentSessionId,
      })
      .execute();
  }

  public async incrementTokenVersion(
    userId: string,
    manager: EntityManager = this.sessionRepo.manager,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(UserSessionEntity)
      .set({ token_version: () => '`token_version` + 1' })
      .where('userId = :userId AND active = true', { userId })
      .execute();
  }

  public findSessions(
    userId: string,
    manager: EntityManager = this.sessionRepo.manager,
  ): Promise<UserSessionEntity[]> {
    const refreshTokenNotExpiredAfter = new Date(
      Date.now() - env.REFRESH_COOKIE_MAX_AGE_DAYS * day,
    );

    return this.sessionRepo.findActiveByUser(
      manager,
      userId,
      refreshTokenNotExpiredAfter,
    );
  }

  public async revokeSessionById(
    userId: string,
    sessionId: string,
    manager: EntityManager = this.sessionRepo.manager,
  ): Promise<void> {
    const session = await this.sessionRepo.findByUser(
      manager,
      userId,
      sessionId,
    );

    if (!session) throw new NotFoundException('Session not found.');

    await this.revokeSession(session, manager);
  }

  public findSessionById(
    userId: string,
    sessionId: string,
    manager: EntityManager = this.sessionRepo.manager,
  ): Promise<UserSessionEntity | null> {
    return this.sessionRepo.findByUser(manager, userId, sessionId, true);
  }

  private async createSession(
    user: UserEntity,
    req: Request | undefined,
    manager: EntityManager,
  ): Promise<UserSessionEntity> {
    const info = createSessionInfoFromRequest(req);
    const location = req ? await this.ipLocation.resolve(req) : null;
    const session = manager.create(UserSessionEntity, {
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
    });

    return manager.save(UserSessionEntity, session);
  }

  private rotateSession(
    session: UserSessionEntity,
    manager: EntityManager,
  ): Promise<UserSessionEntity> {
    return manager.save(UserSessionEntity, {
      ...session,
      token_version: session.token_version + 1,
    });
  }

  private updateSession(
    session: UserSessionEntity,
    refresh: string,
    manager: EntityManager,
  ): Promise<UserSessionEntity> {
    return manager.save(UserSessionEntity, { ...session, refresh });
  }
}
