import type { Response } from 'express';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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

import { RegisterDto, RegistrationPendingDto } from '../models/register.model';
import { AuthService } from '../services/authentication.service';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { SignInDto } from '../models/signin.model';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { LocalAuthGuard } from '@/common/guards/local.guard';
import { RefreshTokenGuard } from '@/common/guards/refresh.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import {
  PERMISSION_MATRIX,
  PermissionDomain,
} from '@/config/permissions.config';
import {
  RequestPasswordResetResponseDto,
  ConfirmPasswordResetResponseDto,
} from '@/modules/domain/identity/models/password-reset.model';
import {
  RequestPasswordResetDto,
  ConfirmPasswordResetDto,
} from '../models/password-reset.model';
import {
  VerifyEmailDto,
  VerifyEmailResponseDto,
  ResendVerificationDto,
  ResendVerificationResponseDto,
} from '../models/verify-email.model';
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';
import { PasswordResetService } from '@/modules/domain/identity/services/password-reset.service';
import { SignOutResponseDto } from '../models/sign-out.model';

@ApiTags('Identity & Sessions')
@UseGuards(CsrfGuard)
@Controller()
export class AuthApiController {
  public constructor(
    private readonly svc: AuthService,
    private readonly evSvc: EmailVerificationService,
    private readonly prSvc: PasswordResetService,
  ) {}

  // POST /register
  @Post('register')
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
      'Creates a new user account, sets a refresh token cookie, and returns an access token with the authenticated user.',
  })
  @ApiCreatedResponse({
    description: 'The user account was created successfully.',
    type: RegistrationPendingDto,
  })
  @ApiConflictResponse({
    description: 'A user with the provided email address already exists.',
  })
  async register(@Body() input: RegisterDto): Promise<RegistrationPendingDto> {
    return this.svc.register(input);
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
  @UseGuards(LocalAuthGuard, PermissionsGuard)
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].READ_ACCOUNT,
  )
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

  // GET /refresh
  @Get('/refresh')
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
  @UseGuards(CsrfGuard, RefreshTokenGuard, PermissionsGuard)
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].READ_ACCOUNT,
  )
  async verifyToken(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.verify(user, res);
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
