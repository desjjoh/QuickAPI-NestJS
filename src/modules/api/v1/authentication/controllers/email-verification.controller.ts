import type { Response } from 'express';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Res,
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
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';
import {
  ValidateEmailChangeTokenDto,
  ValidateEmailChangeTokenResponseDto,
  VerifyEmailDto,
} from '../models/verify-email.model';
import { NanoIdParamPipe } from '@/common/pipes/nanoid.pipe';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { AuthService } from '../services/authentication.service';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';

@ApiTags('Email Verification')
@UseGuards(CsrfGuard)
@Controller('email-verification')
export class EmailVerificationApiController {
  public constructor(
    private readonly evSvc: EmailVerificationService,
    private readonly authSvc: AuthService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
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
    @Query('token_id', NanoIdParamPipe) tokenId: string,
    @Body() dto: ValidateEmailChangeTokenDto,
  ): Promise<ValidateEmailChangeTokenResponseDto> {
    await this.evSvc.validateEmailChangeToken(tokenId, dto.token);

    return new ValidateEmailChangeTokenResponseDto({ valid: true });
  }

  @Throttle({ default: { limit: 3, ttl: 1 * minute } })
  @Patch('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'token_id',
    description: 'The unique NanoID of the email verification token record.',
  })
  @ApiOperation({
    summary: 'Confirm account email change.',
    description:
      'Consumes a one-time email verification token and issues an authenticated session when the token and verification code are valid.',
  })
  @ApiBody({
    type: VerifyEmailDto,
    description:
      'The raw token and 6-digit verification code from the verification email.',
  })
  @ApiOkResponse({
    type: JWTDto,
    description:
      'The email address was verified successfully and an authenticated session was issued.',
  })
  public async verifyEmail(
    @Query('token_id', NanoIdParamPipe) tokenId: string,
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    const user = await this.evSvc.verifyEmail(tokenId, dto.token, dto.code);

    return this.authSvc.signIn(user, res);
  }
}
