import { Controller, Delete, Get, Param, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentSession,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import { Permissions } from '@/common/decorators/permissions.decorator';
import {
  PERMISSION_MATRIX,
  PermissionDomain,
} from '@/config/permissions.config';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { SessionDto } from '@/modules/domain/identity/models/user.model';
import { SessionsApiService } from '../services/sessions.service';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';

@ApiTags('Account Security & Access')
@ApiBearerAuth('access-token')
@Controller('sessions')
@UseGuards(CsrfGuard, JwtAuthGuard, PermissionsGuard)
export class SessionsApiController {
  public constructor(private readonly svc: SessionsApiService) {}

  @Get()
  @ApiOperation({
    summary: 'List sessions',
    description:
      'Returns active sessions owned by the authenticated user. The session in the user payload remains the current session only.',
  })
  @ApiOkResponse({ type: SessionDto, isArray: true })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public findAll(@CurrentUser() user: UserEntity): Promise<SessionDto[]> {
    return this.svc.findAll(user);
  }

  @Delete()
  @ApiOperation({
    summary: 'Revoke all sessions',
    description:
      'Marks every active session for the authenticated user inactive, clears their refresh tokens, and clears the current browser refresh cookie.',
  })
  @ApiNoContentResponse({ description: 'All sessions revoked successfully.' })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async revokeAll(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.svc.revokeAll(user, res);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Revoke a session',
    description:
      'Marks the selected session inactive and clears its refresh token. Revoking the current session also clears its cookie.',
  })
  @ApiNoContentResponse({ description: 'Session revoked successfully.' })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async revoke(
    @CurrentUser() user: UserEntity,
    @CurrentSession() currentSession: UserSessionEntity,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.svc.revoke(user, currentSession, id, res);
  }
}
