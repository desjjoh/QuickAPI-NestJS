import type { Request, Response } from 'express';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { JWTDto } from '@/modules/domain/identity/models/jwt.model';

import { AuthService } from '../services/authentication.service';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { SignInDto } from '../models/signin.model';
import {
  CurrentSession,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { LocalAuthGuard } from '@/common/guards/local.guard';
import { RefreshTokenGuard } from '@/common/guards/refresh.guard';
import { SignOutResponseDto } from '../models/sign-out.model';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import {
  MfaChallengeResponseDto,
  VerifyMfaChallengeDto,
} from '../models/mfa.model';
import { throttlePolicies } from '@/config/throttle-policy.config';

@ApiTags('Identity & Sessions')
@UseGuards(CsrfGuard)
@Controller()
export class AuthApiController {
  public constructor(private readonly svc: AuthService) {}

  // POST /sign-in
  @Post('/sign-in')
  @Throttle({ default: throttlePolicies.signIn })
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
  @ApiAcceptedResponse({
    description: 'Password accepted; an email MFA challenge must be completed.',
    type: MfaChallengeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid email or password.',
  })
  @UseGuards(LocalAuthGuard)
  async signIn(
    @CurrentUser() user: UserEntity,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto | MfaChallengeResponseDto> {
    const result = await this.svc.signIn(user, res, req);

    if (result instanceof MfaChallengeResponseDto)
      res.status(HttpStatus.ACCEPTED);

    return result;
  }

  // POST /sign-in/mfa/verify
  @Post('/sign-in/mfa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: throttlePolicies.otpConfirmation })
  @ApiOperation({
    summary: 'Complete MFA sign-in',
    description:
      'Verifies the email code for a pending sign-in challenge and issues tokens.',
  })
  @ApiBody({ type: VerifyMfaChallengeDto })
  @ApiOkResponse({ type: JWTDto })
  public async verifyMfa(
    @Body() dto: VerifyMfaChallengeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.verifyMfa(dto.challenge_id, dto.code, res, req);
  }

  // POST /refresh
  @Post('/refresh')
  @ApiOperation({
    summary: 'Verify and refresh authenticated session',
    description:
      'Validates and rotates the current refresh-token session. If valid, returns a fresh access token and the current user payload.',
  })
  @ApiOkResponse({
    description:
      'Session is valid and a refreshed authentication response is returned.',
    type: JWTDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is invalid, expired, or has been revoked.',
  })
  @Throttle({ default: throttlePolicies.tokenRefresh })
  @UseGuards(CsrfGuard, RefreshTokenGuard)
  async verifyToken(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: UserSessionEntity,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.verify(user, res, session);
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
  @Throttle({ default: throttlePolicies.signOut })
  @UseGuards(CsrfGuard, RefreshTokenGuard)
  async signOut(
    @CurrentSession() session: UserSessionEntity,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignOutResponseDto> {
    await this.svc.signOut(session, res);

    return new SignOutResponseDto({ message: 'Signed out successfully.' });
  }
}
