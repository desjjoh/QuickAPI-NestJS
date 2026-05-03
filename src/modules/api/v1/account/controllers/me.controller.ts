import type { Response } from 'express';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import { RefreshTokenGuard } from '@/common/guards/refresh.guard';
import {
  PERMISSION_MATRIX,
  PermissionDomain,
} from '@/config/permissions.config';
import {
  Controller,
  UseGuards,
  Delete,
  Patch,
  Res,
  Body,
} from '@nestjs/common';
import { Permissions } from '@/common/decorators/permissions.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { MeApiService } from '../services/me.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UpdateEmailDto } from '../models/updateEmail.model';
import { DeleteAccountDto } from '../models/deleteAccount.model';
import { UpdatePasswordDto } from '../models/updatePassword.model';

@ApiTags('Account Security & Access')
@ApiBearerAuth('access-token')
@Controller('me')
@UseGuards(CsrfGuard, RefreshTokenGuard, PermissionsGuard)
export class MeApiController {
  public constructor(private readonly svc: MeApiService) {}

  // DELETE /
  @Delete('')
  @ApiBody({ type: DeleteAccountDto })
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
    this.svc.deleteMe(user, dto, res);
  }

  // PATCH /email
  @Patch('email')
  @ApiBody({ type: UpdateEmailDto })
  @ApiOperation({
    summary: 'Update account email',
    description:
      'Updates the email address used to identify and sign in to the authenticated account.',
  })
  @ApiOkResponse({
    description: 'Account email updated successfully.',
    type: JWTDto,
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async updateEmail(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateEmailDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.updateEmail(user, dto, res);
  }

  // PATCH /profile/avatar
  @Patch('phone')
  public async updatePrimaryPhone() {}

  // PATCH /password
  @Patch('password')
  @ApiBody({ type: UpdatePasswordDto })
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
    @Body() dto: UpdatePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.updatePassword(user, dto, res);
  }
}
