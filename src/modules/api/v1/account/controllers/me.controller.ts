import type { Response } from 'express';

import { Controller, UseGuards, Patch, Res, Body, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  PERMISSION_MATRIX,
  PermissionDomain,
} from '@/config/permissions.config';

import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';

import { Permissions } from '@/common/decorators/permissions.decorator';
import {
  CurrentSession,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';

import { MeApiService } from '../services/me.service';

import { UpdateEmailDto } from '../models/updateEmail.model';
import { DeleteAccountDto } from '../models/deleteAccount.model';
import { UpdatePasswordDto } from '../models/updatePassword.model';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { UpdateMfaDto } from '../models/updateMfa.model';
import {
  MfaChallengeResponseDto,
  VerifyMfaChallengeDto,
} from '../../authentication/models/mfa.model';

@ApiTags('Account Security & Access')
@ApiBearerAuth('access-token')
@Controller('')
@UseGuards(CsrfGuard, JwtAuthGuard, PermissionsGuard)
export class MeApiController {
  public constructor(private readonly svc: MeApiService) {}

  // POST /delete
  @Post('delete')
  @ApiBody({
    type: DeleteAccountDto,
    description:
      'Account deletion confirmation payload. Includes the required credentials or confirmation fields needed to verify that the authenticated user intentionally requested account deletion.',
  })
  @ApiOperation({
    summary: 'Delete current account',
    description:
      'Permanently deletes the authenticated user account and associated account-owned data.',
  })
  @ApiNoContentResponse({
    description: 'Account deleted successfully.',
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].DELETE_ACCOUNT,
  )
  public async deleteMe(
    @CurrentUser() user: UserEntity,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    return this.svc.deleteMe(user, dto, res);
  }

  // POST /email
  @Post('email')
  @ApiBody({
    type: UpdateEmailDto,
    description:
      'Email change request payload. Includes the new email address and current password to confirm the account owner is authorizing the change.',
  })
  @ApiOperation({
    summary: 'Request account email change',
    description:
      'Sends a verification email to the requested new email address. The account email is not changed until the verification token is confirmed.',
  })
  @ApiOkResponse({
    description:
      'Email change verification sent successfully. Returns the refreshed authenticated user payload and updated tokens.',
    type: JWTDto,
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async sendEmailVerification(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateEmailDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.updateEmail(user, dto, res);
  }

  // PATCH /password
  @Patch('password')
  @ApiBody({
    type: UpdatePasswordDto,
    description:
      'Password update payload. Includes the current password and the new password so the account owner can be verified before credentials are changed.',
  })
  @ApiOperation({
    summary: 'Update account password',
    description:
      'Updates the password used to sign in to the authenticated account and may invalidate existing sessions.',
  })
  @ApiOkResponse({
    description: 'Account password updated successfully.',
    type: JWTDto,
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async updatePassword(
    @CurrentUser() user: UserEntity,
    @CurrentSession() currentSession: UserSessionEntity,
    @Body() dto: UpdatePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.updatePassword(user, currentSession, dto, res);
  }

  // PATCH /mfa
  @Patch('mfa')
  @ApiBody({ type: UpdateMfaDto })
  @ApiOperation({
    summary: 'Update sign-in MFA',
    description:
      'Requires the current password. Enabling MFA sends an email verification code; disabling MFA takes effect immediately.',
  })
  @ApiOkResponse({ type: MfaChallengeResponseDto })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async updateMfa(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateMfaDto,
  ): Promise<MfaChallengeResponseDto | void> {
    return this.svc.updateMfa(user, dto);
  }

  // POST /mfa/confirm
  @Post('mfa/confirm')
  @ApiBody({ type: VerifyMfaChallengeDto })
  @ApiOperation({
    summary: 'Confirm sign-in MFA enrollment',
    description:
      'Verifies the emailed code, enables sign-in MFA for the current account, and revokes every other session to require a new sign-in.',
  })
  @ApiNoContentResponse({ description: 'Sign-in MFA enabled successfully.' })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async confirmMfa(
    @CurrentUser() user: UserEntity,
    @CurrentSession() currentSession: UserSessionEntity,
    @Body() dto: VerifyMfaChallengeDto,
  ): Promise<void> {
    return this.svc.confirmMfa(user, currentSession, dto);
  }
}
