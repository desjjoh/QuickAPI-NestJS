import { Injectable } from '@nestjs/common';
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
import { UserRepository } from '../repositories/user.repository';

import {
  DecodedToken,
  TokenPair,
} from '@/modules/system/tokens/types/token.types';
import {
  createSessionInfoFromRequest,
  SessionInfo,
} from '@/common/helpers/session-info.helper';

@Injectable()
export class RefreshService {
  public constructor(
    private readonly tokenSvc: TokenService,
    private readonly userRepo: UserRepository,
    private readonly requestContext: RequestContext,
  ) {}

  public async issueTokens(user: UserEntity, res: Response): Promise<JWTDto> {
    const tokens: TokenPair = await this.tokenSvc.createTokenPair({
      sub: user.id,
      email: user.identity.email,
      version: user.credentials.token_version,
    });

    const hashedRefreshToken: string = this.tokenSvc.hashToken(
      tokens.refresh_token,
    );

    await this.updateSession(user, hashedRefreshToken);

    const accessToken: DecodedToken = this.tokenSvc.decode(tokens.access_token);
    const refreshToken: DecodedToken = this.tokenSvc.decode(
      tokens.refresh_token,
    );

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
    });
  }

  public async revokeTokens(user: UserEntity, res: Response): Promise<void> {
    await this.userRepo.incrementTokenVersion(user.id);

    res.clearCookie(getRefreshCookieName(), getClearRefreshCookieOptions());
  }

  private async updateSession(
    user: UserEntity,
    refresh: string,
  ): Promise<UserEntity> {
    const req: Request | undefined = this.requestContext.get('request');
    const session: SessionInfo | null = createSessionInfoFromRequest(req);

    const sessionFields = session
      ? {
          browser: session.browser,
          browser_version: session.browser_version,
          device: session.device,
          os: session.os,
          os_version: session.os_version,
          ip_address: session.ip_address,
          user_agent: session.user_agent,
          origin: session.origin,
        }
      : {};

    const updatedUser: UserEntity = this.userRepo.merge(user, {
      credentials: {
        ...user.credentials,
        refresh,
        ...sessionFields,
      },
    });

    return this.userRepo.save(updatedUser);
  }
}
