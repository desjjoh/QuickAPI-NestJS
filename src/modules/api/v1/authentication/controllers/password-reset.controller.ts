import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
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
  ValidatePasswordResetTokenResponseDto,
} from '@/modules/domain/identity/models/password-reset.model';
import { PasswordResetService } from '@/modules/domain/identity/services/password-reset.service';
import {
  ConfirmPasswordResetDto,
  RequestPasswordResetDto,
  ValidatePasswordResetTokenDto,
} from '../models/password-reset.model';
import { NanoIdParamPipe } from '@/common/pipes/nanoid.pipe';

@ApiTags('Password Reset')
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
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'token_id',
    description: 'The unique NanoID of the password reset token record.',
  })
  @ApiOperation({
    summary: 'Validate password reset token',
    description:
      'Checks whether a password reset token is valid without consuming it, allowing clients to render the reset form only for valid links.',
  })
  @ApiBody({
    type: ValidatePasswordResetTokenDto,
    description: 'The raw token from the reset link.',
  })
  @ApiOkResponse({ type: ValidatePasswordResetTokenResponseDto })
  public async validatePasswordResetToken(
    @Query('token_id', NanoIdParamPipe) tokenId: string,
    @Body() dto: ValidatePasswordResetTokenDto,
  ): Promise<ValidatePasswordResetTokenResponseDto> {
    await this.prSvc.validatePasswordResetToken(tokenId, dto.token);
    return new ValidatePasswordResetTokenResponseDto({ valid: true });
  }

  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @Patch('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'token_id',
    description: 'The unique NanoID of the password reset token record.',
  })
  @ApiOperation({
    summary: 'Confirm password reset',
    description:
      'Consumes a valid password reset token and updates the account password.',
  })
  @ApiOkResponse({ type: ConfirmPasswordResetResponseDto })
  public async confirmPasswordReset(
    @Query('token_id', NanoIdParamPipe) tokenId: string,
    @Body() dto: ConfirmPasswordResetDto,
  ): Promise<ConfirmPasswordResetResponseDto> {
    await this.prSvc.confirmPasswordReset(tokenId, dto.token, dto.password);
    return new ConfirmPasswordResetResponseDto({
      message: 'Password reset successfully.',
    });
  }
}
