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

import { RegisterDto } from '../models/register.model';
import { AuthService } from '../services/authentication.service';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { SignInDto } from '../models/signin.model';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { LocalAuthGuard } from '@/common/guards/local.guard';
import { RefreshTokenGuard } from '@/common/guards/refresh.guard';

@ApiTags('Authentication')
@UseGuards(CsrfGuard)
@Controller()
export class AuthApiController {
  public constructor(private readonly service: AuthService) {}

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
    type: JWTDto,
  })
  @ApiConflictResponse({
    description: 'A user with the provided email address already exists.',
  })
  async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.service.register(input, res);
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
    return this.service.signIn(user, res);
  }

  // POST /sign-out
  @Post('/sign-out')
  @ApiOperation({
    summary: 'Sign out user and revoke session',
    description:
      'Invalidates the current refresh token, clears authentication cookies, and revokes the active session.',
  })
  @ApiOkResponse({
    description: 'User successfully signed out.',
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
  ): Promise<void> {
    await this.service.signOut(user, res);
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
  @UseGuards(CsrfGuard, RefreshTokenGuard)
  async verifyToken(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.service.verify(user, res);
  }
}
