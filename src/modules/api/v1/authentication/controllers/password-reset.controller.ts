import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { minute } from '@/common/constants/milliseconds.constants';
import {
  ConfirmPasswordResetResponseDto,
  RequestPasswordResetResponseDto,
  VerifyPasswordResetCodeResponseDto,
} from '@/modules/domain/identity/models/password-reset.model';
import { PasswordResetService } from '@/modules/domain/identity/services/password-reset.service';
import {
  ConfirmPasswordResetDto,
  RequestPasswordResetDto,
  VerifyPasswordResetCodeDto,
} from '../models/password-reset.model';
import { NanoIdParamPipe } from '@/common/pipes/nanoid.pipe';
import { CsrfGuard } from '@/common/guards/csrf.guard';

@ApiTags('Password Reset')
@UseGuards(CsrfGuard)
@Controller('password-reset')
export class PasswordResetApiController {
  public constructor(private readonly prSvc: PasswordResetService) {}

  @Throttle({ default: { limit: 3, ttl: 1 * minute } })
  @Post('request')
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Requests a password reset email. The response is generic and does not reveal whether the email address exists.',
  })
  @ApiOkResponse({ type: RequestPasswordResetResponseDto })
  public async requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<RequestPasswordResetResponseDto> {
    await this.prSvc.requestPasswordReset(dto.email);
    return new RequestPasswordResetResponseDto({
      message:
        'If an account exists for this email, a password reset email will be sent.',
    });
  }

  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify password reset code',
    description:
      'Verifies the emailed six-digit code and returns a short-lived reset authorization. This does not change the password or authenticate the user.',
  })
  @ApiBody({
    type: VerifyPasswordResetCodeDto,
    description: 'The account email and emailed six-digit code.',
  })
  @ApiOkResponse({ type: VerifyPasswordResetCodeResponseDto })
  public async verifyPasswordResetCode(
    @Body() dto: VerifyPasswordResetCodeDto,
  ): Promise<VerifyPasswordResetCodeResponseDto> {
    const authorization = await this.prSvc.verifyPasswordResetCode(
      dto.email,
      dto.code,
    );

    return new VerifyPasswordResetCodeResponseDto({
      challenge_id: authorization.id,
      authorization: authorization.token,
      expires_at: authorization.expires_at,
    });
  }

  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @Patch('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'challenge_id',
    description: 'The identifier returned after the OTP is verified.',
  })
  @ApiOperation({
    summary: 'Confirm password reset',
    description:
      'Consumes a verified, short-lived password reset authorization and updates the account password. The authorization cannot be reused.',
  })
  @ApiOkResponse({ type: ConfirmPasswordResetResponseDto })
  public async confirmPasswordReset(
    @Query('challenge_id', NanoIdParamPipe) challengeId: string,
    @Body() dto: ConfirmPasswordResetDto,
  ): Promise<ConfirmPasswordResetResponseDto> {
    await this.prSvc.confirmPasswordReset(
      challengeId,
      dto.authorization,
      dto.password,
    );

    return new ConfirmPasswordResetResponseDto({
      message: 'Password reset successfully.',
    });
  }
}
