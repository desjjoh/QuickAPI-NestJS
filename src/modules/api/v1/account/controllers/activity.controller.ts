import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import {
  PERMISSION_MATRIX,
  PermissionDomain,
} from '@/config/permissions.config';
import { throttlePolicies } from '@/config/throttle-policy.config';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import {
  AccountActivityPageDto,
  AccountActivityQueryDto,
} from '../models/activity.model';
import { ActivityApiService } from '../services/activity.service';

@ApiTags('Account Activity')
@ApiBearerAuth('access-token')
@Controller('activity')
@UseGuards(CsrfGuard, JwtAuthGuard, PermissionsGuard)
@Throttle({ default: throttlePolicies.sessionRead })
export class ActivityApiController {
  public constructor(private readonly service: ActivityApiService) {}

  @Get()
  @ApiOperation({
    summary: 'List my account activity',
    description:
      'Returns activity performed by the authenticated user across all domains. The actor cannot be supplied by the request.',
  })
  @ApiOkResponse({ type: AccountActivityPageDto })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public findAll(
    @CurrentUser() user: UserEntity,
    @Query() query: AccountActivityQueryDto,
  ): Promise<AccountActivityPageDto> {
    return this.service.findForUser(user, query);
  }
}
