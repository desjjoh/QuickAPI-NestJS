import type { Response } from 'express';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { minute } from '@/common/constants/milliseconds.constants';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { Permissions } from '@/common/decorators/permissions.decorator';

import {
  RegisterDto,
  RegistrationPendingDto,
  ResendRegistrationDto,
  ValidateRegistrationTokenDto,
  ValidateRegistrationTokenResponseDto,
  VerifyRegistrationDto,
  VerifyRegistrationResponseDto,
} from '../models/register.model';
import { AuthService } from '../services/authentication.service';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { SignInDto } from '../models/signin.model';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { LocalAuthGuard } from '@/common/guards/local.guard';
import { RefreshTokenGuard } from '@/common/guards/refresh.guard';
import { SignOutResponseDto } from '../models/sign-out.model';

@ApiTags('Identity & Sessions')
@UseGuards(CsrfGuard)
@Controller()
export class AuthApiController {
  public constructor(private readonly svc: AuthService) {}

  // POST /register/request
  @Post('register/request')
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
  async register(@Body() input: RegisterDto): Promise<RegistrationPendingDto> {
    return this.svc.register(input);
  }

  // POST /register/resend
  @Post('register/resend')
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
  async resendRegistration(
    @Body() input: ResendRegistrationDto,
  ): Promise<RegistrationPendingDto> {
    return this.svc.resendRegistration(input.email);
  }

  // POST /register/validate
  @Post('register/validate')
  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @ApiBody({
    type: ValidateRegistrationTokenDto,
    description:
      'The registration token ID, raw token, and 6-digit verification code from the registration verification email.',
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
  async validateRegistration(
    @Body() input: ValidateRegistrationTokenDto,
  ): Promise<ValidateRegistrationTokenResponseDto> {
    await this.svc.validateRegistration(input.token_id, input.token);

    return new ValidateRegistrationTokenResponseDto({ valid: true });
  }

  // PATCH /register/confirm
  @Patch('register/confirm')
  @Throttle({ default: { limit: 3, ttl: 1 * minute } })
  @ApiBody({
    type: VerifyRegistrationDto,
    description:
      'The registration token ID and raw token from the registration verification link.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify a pending registration',
    description:
      'Consumes a one-time registration token and creates the user account when the token is valid.',
  })
  @ApiOkResponse({
    description: 'The pending registration was verified successfully.',
    type: VerifyRegistrationResponseDto,
  })
  async verifyRegistration(
    @Body() input: VerifyRegistrationDto,
  ): Promise<VerifyRegistrationResponseDto> {
    await this.svc.verifyRegistration(input.token_id, input.token, input.code);

    return new VerifyRegistrationResponseDto({
      message: 'Registration verified successfully.',
    });
  }

  // POST /sign-in
  @Post('/sign-in')
  @Throttle({ default: { limit: 5, ttl: 1 * minute } })
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
  @ApiUnauthorizedResponse({
    description: 'Invalid email or password.',
  })
  @UseGuards(LocalAuthGuard)
  async signIn(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.signIn(user, res);
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
  @ApiBearerAuth('access-token')
  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @UseGuards(CsrfGuard, RefreshTokenGuard)
  async signOut(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignOutResponseDto> {
    await this.svc.signOut(user, res);

    return new SignOutResponseDto({ message: 'Signed out successfully.' });
  }

  // POST /refresh
  @Post('/refresh')
  @ApiOperation({
    summary: 'Verify and refresh authenticated session',
    description:
      'Validates the current authentication session using refresh and access token context. If valid, returns a fresh access token and the current user payload.',
  })
  @ApiOkResponse({
    description:
      'Session is valid and a refreshed authentication response is returned.',
    type: JWTDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is invalid, expired, or has been revoked.',
  })
  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @ApiBearerAuth('access-token')
  @UseGuards(CsrfGuard, RefreshTokenGuard)
  async verifyToken(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.verify(user, res);
  }
}
