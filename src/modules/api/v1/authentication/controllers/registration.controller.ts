import type { Response } from 'express';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { minute } from '@/common/constants/milliseconds.constants';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import {
  RegisterDto,
  RegistrationPendingDto,
  ResendRegistrationDto,
  VerifyRegistrationDto,
} from '../models/register.model';
import { RegistrationService } from '../services/registration.service';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { AuthService } from '../services/authentication.service';

@ApiTags('Registration')
@UseGuards(CsrfGuard)
@Controller('registration')
export class RegistrationApiController {
  public constructor(
    private readonly svc: RegistrationService,
    private readonly authSvc: AuthService,
  ) {}

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
      'Creates a pending registration challenge and sends a verification code before creating the user account.',
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
      'Email address for a pending registration whose verification code should be resent.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend pending registration verification',
    description:
      'Creates a fresh registration challenge and verification code for an existing pending registration.',
  })
  @ApiOkResponse({
    description: 'A fresh registration verification code was sent.',
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

  @Post('confirm')
  @Throttle({ default: { limit: 3, ttl: 1 * minute } })
  @ApiBody({
    type: VerifyRegistrationDto,
    description:
      'The registration challenge identifier and 6-digit verification code.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify a pending registration',
    description:
      'Consumes a one-time registration challenge, creates the user account, and issues an authenticated session when the code is valid.',
  })
  @ApiOkResponse({
    description:
      'The pending registration was verified successfully and an authenticated session was issued.',
    type: JWTDto,
  })
  public async verifyRegistration(
    @Body() input: VerifyRegistrationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    const user = await this.svc.verifyRegistration(
      input.challenge_id,
      input.code,
    );

    return this.authSvc.completeSignIn(user, res);
  }
}
