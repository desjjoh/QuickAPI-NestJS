import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { minute } from '@/common/constants/milliseconds.constants';
import { Throttle } from '@nestjs/throttler';
import { SecurityApiService } from '../services/security.service';
import { CsrfDto } from '../models/csrf.model';
import {
  RequestPasswordResetResponseDto,
  ConfirmPasswordResetResponseDto,
  ValidatePasswordResetTokenResponseDto,
} from '@/modules/domain/identity/models/password-reset.model';
import {
  RequestPasswordResetDto,
  ConfirmPasswordResetDto,
  ValidatePasswordResetTokenDto,
} from '../models/password-reset.model';

import { PasswordResetService } from '@/modules/domain/identity/services/password-reset.service';

@ApiTags('Request Security')
@Controller()
export class SecurityApiController {
  constructor(
    private readonly svc: SecurityApiService,

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

  // POST /password-reset/validate
  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @Post('password-reset/validate')
  @ApiOperation({
    summary: 'Validate password reset token',
    description:
      'Checks whether a password reset token is valid without consuming it, allowing clients to render the reset form only for valid links.',
  })
  @ApiBody({
    type: ValidatePasswordResetTokenDto,
    description:
      'The password reset token ID and raw token from the reset link.',
  })
  @ApiOkResponse({
    type: ValidatePasswordResetTokenResponseDto,
  })
  public async validatePasswordResetToken(
    @Body() dto: ValidatePasswordResetTokenDto,
  ): Promise<ValidatePasswordResetTokenResponseDto> {
    await this.prSvc.validatePasswordResetToken(dto.token_id, dto.token);

    return new ValidatePasswordResetTokenResponseDto({ valid: true });
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
