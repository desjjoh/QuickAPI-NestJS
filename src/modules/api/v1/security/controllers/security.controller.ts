import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { minute } from '@/common/constants/milliseconds.constants';
import { Throttle } from '@nestjs/throttler';
import { SecurityApiService } from '../services/security.service';
import { CsrfDto } from '../models/csrf.model';
import {
  ResendVerificationDto,
  ResendVerificationResponseDto,
  VerifyEmailDto,
  VerifyEmailResponseDto,
} from '../models/verify-email.model';

import { PasswordResetService } from '@/modules/domain/identity/services/password-reset.service';
import {
  ConfirmPasswordResetDto,
  RequestPasswordResetDto,
} from '../models/password-reset.model';
import {
  ConfirmPasswordResetResponseDto,
  RequestPasswordResetResponseDto,
} from '@/modules/domain/identity/models/password-reset.model';
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';

@ApiTags('Request Security')
@Controller()
export class SecurityApiController {
  constructor(
    private readonly svc: SecurityApiService,
    private readonly evSvc: EmailVerificationService,
    private readonly prSvc: PasswordResetService,
  ) {}

  // GET /csrf
  @Get('/csrf')
  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @ApiOperation({
    summary: 'Issue CSRF token',
    description:
      'Generates a CSRF token pair. The server stores a signed secret in an httpOnly cookie and returns a CSRF token for request validation.',
  })
  @ApiOkResponse({
    description: 'CSRF token generated successfully.',
    type: CsrfDto,
  })
  public async getCsrf(
    @Res({ passthrough: true }) res: Response,
  ): Promise<CsrfDto> {
    return this.svc.issueCsrf(res);
  }

  // POST /verify-email/confirm
  @Throttle({ default: { limit: 3, ttl: 1 * minute } })
  @Post('verify-email/confirm')
  @ApiOperation({
    summary: 'Verify a newly registered account email address.',
    description:
      'Consumes a one-time email verification token and activates the account when the token is valid.',
  })
  @ApiBody({
    type: VerifyEmailDto,
    description:
      'The email verification token ID and raw token from the verification link.',
  })
  @ApiOkResponse({
    type: VerifyEmailResponseDto,
    description: 'The email address was verified successfully.',
  })
  public async verifyEmail(
    @Body() dto: VerifyEmailDto,
  ): Promise<VerifyEmailResponseDto> {
    await this.evSvc.verifyEmail(dto.token_id, dto.token);

    return new VerifyEmailResponseDto({
      message: 'Email address verified successfully.',
    });
  }

  // POST /verify-email/resend
  @Throttle({ default: { limit: 3, ttl: 1 * minute } })
  @Post('verify-email/resend')
  @ApiOperation({
    summary: 'Resend email verification',
    description:
      'Requests a new email verification message for an account that still requires verification.',
  })
  @ApiBody({
    type: ResendVerificationDto,
    description: 'The email address that should receive a verification email.',
  })
  @ApiOkResponse({
    type: ResendVerificationResponseDto,
    description:
      'A generic confirmation response. The response does not reveal whether the email address is registered.',
  })
  public async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<ResendVerificationResponseDto> {
    await this.evSvc.resendVerificationEmail(dto.email);

    return new ResendVerificationResponseDto({
      message:
        'If an account exists and requires verification, a verification email will be sent.',
    });
  }

  // POST /password-reset/request
  @Throttle({ default: { limit: 3, ttl: 1 * minute } })
  @Post('password-reset/request')
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Requests a password reset email. The response is generic and does not reveal whether the email address exists.',
  })
  @ApiOkResponse({
    type: RequestPasswordResetResponseDto,
  })
  public async requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<RequestPasswordResetResponseDto> {
    await this.prSvc.requestPasswordReset(dto.email);

    return new RequestPasswordResetResponseDto({
      message:
        'If an account exists for this email, a password reset email will be sent.',
    });
  }

  // POST /pasword-reset/confirm
  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @Post('password-reset/confirm')
  @ApiOperation({
    summary: 'Confirm password reset',
    description:
      'Consumes a valid password reset token and updates the account password.',
  })
  @ApiOkResponse({
    type: ConfirmPasswordResetResponseDto,
  })
  public async confirmPasswordReset(
    @Body() dto: ConfirmPasswordResetDto,
  ): Promise<ConfirmPasswordResetResponseDto> {
    await this.prSvc.confirmPasswordReset(
      dto.token_id,
      dto.token,
      dto.password,
    );

    return new ConfirmPasswordResetResponseDto({
      message: 'Password reset successfully.',
    });
  }
}
