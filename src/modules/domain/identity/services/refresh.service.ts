import { Injectable } from '@nestjs/common';
import { Response } from 'express';

import {
  getClearRefreshCookieOptions,
  getRefreshCookieName,
  getRefreshCookieOptions,
} from '@/config/cookie.config';

import { TokenService } from '@/modules/system/tokens/services/token.service';

import { JWTDto } from '../models/jwt.model';
import { UserEntity } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';

import {
  DecodedToken,
  TokenPair,
} from '@/modules/system/tokens/types/token.types';

@Injectable()
export class RefreshService {
  public constructor(
    private readonly tokenSvc: TokenService,
    private readonly userRepo: UserRepository,
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

    await this.updateRefreshToken(user, hashedRefreshToken);

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

  private async updateRefreshToken(
    user: UserEntity,
    refresh: string,
  ): Promise<UserEntity> {
    const updatedUser: UserEntity = this.userRepo.merge(user, {
      credentials: {
        ...user.credentials,
        refresh,
      },
    });

    return this.userRepo.save(updatedUser);
  }
}
