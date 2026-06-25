import type { Response } from 'express';
import { Controller, Post, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { minute } from '@/common/constants/milliseconds.constants';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';

import { AuthService } from '../services/authentication.service';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { SignInDto } from '../models/signin.model';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { LocalAuthGuard } from '@/common/guards/local.guard';
import { RefreshTokenGuard } from '@/common/guards/refresh.guard';
import { SignOutResponseDto } from '../models/sign-out.model';

@ApiTags('Identity & Sessions')
@UseGuards(CsrfGuard)
@Controller()
export class AuthApiController {
  public constructor(private readonly svc: AuthService) {}

  // POST /sign-in
  @Post('/sign-in')
  @Throttle({ default: { limit: 5, ttl: 1 * minute } })
  @ApiBody({
    type: SignInDto,
    description: 'User credentials for authentication.',
  })
  @ApiOperation({
    summary: 'Sign in user',
    description:
      'Authenticates user credentials, issues access token, and sets refresh token cookie.',
  })
  @ApiOkResponse({
    description: 'User successfully authenticated.',
    type: JWTDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid email or password.',
  })
  @UseGuards(LocalAuthGuard)
  async signIn(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.signIn(user, res);
  }

  // POST /refresh
  @Post('/refresh')
  @ApiOperation({
    summary: 'Verify and refresh authenticated session',
    description:
      'Validates the current authentication session using refresh and access token context. If valid, returns a fresh access token and the current user payload.',
  })
  @ApiOkResponse({
    description:
      'Session is valid and a refreshed authentication response is returned.',
    type: JWTDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is invalid, expired, or has been revoked.',
  })
  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @ApiBearerAuth('access-token')
  @UseGuards(CsrfGuard, RefreshTokenGuard)
  async verifyToken(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.verify(user, res);
  }

  // POST /sign-out
  @Post('/sign-out')
  @ApiOperation({
    summary: 'Sign out user and revoke session',
    description:
      'Invalidates the current refresh token, clears authentication cookies, and revokes the active session.',
  })
  @ApiOkResponse({
    description: 'User successfully revoked the active session.',
    type: SignOutResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'User is not authenticated or session is already invalid.',
  })
  @ApiBearerAuth('access-token')
  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @UseGuards(CsrfGuard, RefreshTokenGuard)
  async signOut(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignOutResponseDto> {
    await this.svc.signOut(user, res);

    return new SignOutResponseDto({ message: 'Signed out successfully.' });
  }
}
