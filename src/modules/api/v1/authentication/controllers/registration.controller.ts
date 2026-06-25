import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { minute } from '@/common/constants/milliseconds.constants';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { AuthService } from '../services/authentication.service';
import {
  RegisterDto,
  RegistrationPendingDto,
  ResendRegistrationDto,
  ValidateRegistrationTokenDto,
  ValidateRegistrationTokenResponseDto,
  VerifyRegistrationDto,
  VerifyRegistrationResponseDto,
} from '../models/register.model';

@ApiTags('Registration')
@UseGuards(CsrfGuard)
@Controller('registration')
export class RegistrationApiController {
  public constructor(private readonly svc: AuthService) {}

  @Post('request')
  @Throttle({ default: { limit: 3, ttl: 1 * minute } })
  @ApiBody({
    type: RegisterDto,
    description:
      'Payload required to create a new user account including identity and profile information such as email, password, name, date of birth, and gender selection.',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a pending registration token and sends a verification email before creating the user account.',
  })
  @ApiCreatedResponse({
    description: 'The registration request is pending email verification.',
    type: RegistrationPendingDto,
  })
  @ApiConflictResponse({
    description: 'A user with the provided email address already exists.',
  })
  public async register(
    @Body() input: RegisterDto,
  ): Promise<RegistrationPendingDto> {
    return this.svc.register(input);
  }

  @Post('resend')
  @Throttle({ default: { limit: 3, ttl: 1 * minute } })
  @ApiBody({
    type: ResendRegistrationDto,
    description:
      'Email address for a pending registration whose verification link should be resent.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend pending registration verification',
    description:
      'Creates a fresh registration verification link for an existing pending registration using the email address in the request body.',
  })
  @ApiOkResponse({
    description: 'A fresh registration verification link was sent.',
    type: RegistrationPendingDto,
  })
  @ApiConflictResponse({
    description: 'A user with the provided email address already exists.',
  })
  public async resendRegistration(
    @Body() input: ResendRegistrationDto,
  ): Promise<RegistrationPendingDto> {
    return this.svc.resendRegistration(input.email);
  }

  @Post(':token_id/validate')
  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @ApiParam({
    name: 'token_id',
    description: 'The unique NanoID of the registration token record.',
  })
  @ApiBody({
    type: ValidateRegistrationTokenDto,
    description: 'The raw token from the registration verification link.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate pending registration token',
    description:
      'Checks whether a registration token is valid without consuming it, allowing clients to render the registration confirmation form only for valid links.',
  })
  @ApiOkResponse({
    description: 'The pending registration token is valid.',
    type: ValidateRegistrationTokenResponseDto,
  })
  public async validateRegistration(
    @Param('token_id') tokenId: string,
    @Body() input: ValidateRegistrationTokenDto,
  ): Promise<ValidateRegistrationTokenResponseDto> {
    await this.svc.validateRegistration(tokenId, input.token);
    return new ValidateRegistrationTokenResponseDto({ valid: true });
  }

  @Patch(':token_id/confirm')
  @Throttle({ default: { limit: 3, ttl: 1 * minute } })
  @ApiParam({
    name: 'token_id',
    description: 'The unique NanoID of the registration token record.',
  })
  @ApiBody({
    type: VerifyRegistrationDto,
    description:
      'The raw token and 6-digit verification code from the registration verification email.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify a pending registration',
    description:
      'Consumes a one-time registration token and creates the user account when the token and verification code are valid.',
  })
  @ApiOkResponse({
    description: 'The pending registration was verified successfully.',
    type: VerifyRegistrationResponseDto,
  })
  public async verifyRegistration(
    @Param('token_id') tokenId: string,
    @Body() input: VerifyRegistrationDto,
  ): Promise<VerifyRegistrationResponseDto> {
    await this.svc.verifyRegistration(tokenId, input.token, input.code);
    return new VerifyRegistrationResponseDto({
      message: 'Registration verified successfully.',
    });
  }
}
