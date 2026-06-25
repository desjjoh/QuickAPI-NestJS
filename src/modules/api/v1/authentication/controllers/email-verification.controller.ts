import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { minute } from '@/common/constants/milliseconds.constants';
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';
import {
  ValidateEmailChangeTokenDto,
  ValidateEmailChangeTokenResponseDto,
  VerifyEmailDto,
  VerifyEmailResponseDto,
} from '../models/verify-email.model';

@ApiTags('Email Verification')
@Controller('email-verification')
export class EmailVerificationApiController {
  public constructor(private readonly evSvc: EmailVerificationService) {}

  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @Post(':token_id/validate')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'token_id',
    description: 'The unique NanoID of the email verification token record.',
  })
  @ApiOperation({
    summary: 'Validate email change token',
    description:
      'Checks whether an email change token is valid without consuming it, allowing clients to render the email change confirmation form only for valid links.',
  })
  @ApiBody({
    type: ValidateEmailChangeTokenDto,
    description: 'The raw token from the verification link.',
  })
  @ApiOkResponse({
    type: ValidateEmailChangeTokenResponseDto,
    description: 'The email change token is valid.',
  })
  public async validateEmailChangeToken(
    @Param('token_id') tokenId: string,
    @Body() dto: ValidateEmailChangeTokenDto,
  ): Promise<ValidateEmailChangeTokenResponseDto> {
    await this.evSvc.validateEmailChangeToken(tokenId, dto.token);
    return new ValidateEmailChangeTokenResponseDto({ valid: true });
  }

  @Throttle({ default: { limit: 3, ttl: 1 * minute } })
  @Patch(':token_id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'token_id',
    description: 'The unique NanoID of the email verification token record.',
  })
  @ApiOperation({
    summary: 'Confirm account email change.',
    description:
      'Consumes a one-time email change token and updates the account email when the token and verification code are valid.',
  })
  @ApiBody({
    type: VerifyEmailDto,
    description:
      'The raw token and 6-digit verification code from the verification email.',
  })
  @ApiOkResponse({
    type: VerifyEmailResponseDto,
    description: 'The email address change was verified successfully.',
  })
  public async verifyEmail(
    @Param('token_id') tokenId: string,
    @Body() dto: VerifyEmailDto,
  ): Promise<VerifyEmailResponseDto> {
    await this.evSvc.verifyEmail(tokenId, dto.token, dto.code);
    return new VerifyEmailResponseDto({
      message: 'Email address verified successfully.',
    });
  }
}
