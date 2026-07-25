import type { Response } from 'express';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { minute } from '@/common/constants/milliseconds.constants';
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';
import { VerifyEmailDto } from '../models/verify-email.model';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { AuthService } from '../services/authentication.service';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import {
  CurrentSession,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { RefreshTokenGuard } from '@/common/guards/refresh.guard';

@ApiTags('Email Verification')
@ApiBearerAuth('access-token')
@UseGuards(CsrfGuard, RefreshTokenGuard)
@Controller('email-verification')
export class EmailVerificationApiController {
  public constructor(
    private readonly evSvc: EmailVerificationService,
    private readonly authSvc: AuthService,
  ) {}

  @Throttle({ default: { limit: 3, ttl: 1 * minute } })
  @Patch('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm account email change.',
    description:
      'Consumes a one-time email verification challenge, rotates the current session tokens, and requires other sessions to refresh their access tokens.',
  })
  @ApiBody({
    type: VerifyEmailDto,
    description:
      'The email verification challenge identifier and 6-digit code.',
  })
  @ApiOkResponse({
    type: JWTDto,
    description:
      'The email address was verified successfully and an authenticated session was issued.',
  })
  public async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @CurrentUser() currentUser: UserEntity,
    @CurrentSession() currentSession: UserSessionEntity,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    const user = await this.evSvc.verifyEmail(
      dto.challenge_id,
      dto.code,
      currentUser,
    );

    return this.authSvc.verify(user, res, currentSession);
  }
}
