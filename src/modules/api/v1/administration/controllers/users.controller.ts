import { ApiPlatformAdmin } from '@/common/decorators/platform-admin.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import { PaginationDto } from '@/common/models/pagination.model';
import {
  PERMISSION_MATRIX,
  PermissionDomain,
} from '@/config/permissions.config';
import { UserPaginationOptions } from '@/modules/domain/identity/models/user.model';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiConflictResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { EntityIdParam } from '@/common/decorators/id-param.decorator';
import { Idempotent } from '@/common/decorators/idempotent.decorator';
import { NanoIdParamPipe } from '@/common/pipes/nanoid.pipe';
import { UserAdminService } from '../service/users.service';
import { throttlePolicies } from '@/config/throttle-policy.config';
import { Throttle } from '@nestjs/throttler';
import { UpdateUserAdministrationDto } from '../models/update-user.model';
import { UserAdministrationActionDto } from '../models/user-action.model';
import { UserAdministrationDto } from '@/modules/domain/identity/models/user-administration.model';
import { UserActivityAdminService } from '../service/user-activity.service';

import {
  AuditEventPageDto,
  UserActivitySearchQueryDto,
} from '@/common/models/audit.model';

@ApiPlatformAdmin()
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
@Throttle({ default: throttlePolicies.administrationRead })
export class UserAdministrationController {
  public constructor(
    private readonly svc: UserAdminService,
    private readonly activity: UserActivityAdminService,
  ) {}

  // GET /
  @Get('')
  @ApiOperation({
    summary: 'List paginated users',
    description:
      'Returns paginated user records with identity, profile, roles, permission data and the administration version required for edits/deletion. Supports pagination, sorting and search.',
  })
  @ApiOkResponse({
    description: 'Paginated user records returned successfully.',
    type: PaginationDto<UserAdministrationDto>,
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.USER_ADMINISTRATION].READ_USERS,
  )
  public async getPaginatedUsers(
    @Query() pageOptions: UserPaginationOptions,
  ): Promise<PaginationDto<UserAdministrationDto>> {
    return this.svc.paginateUsers(pageOptions);
  }

  @Patch(':id')
  @Idempotent('identity.administration.user.update')
  @Throttle({ default: throttlePolicies.administrationMutation })
  @ApiOperation({
    summary: 'Update a user account',
    description:
      'Updates account status or replaces roles using the required expected_version from an administration read. Stale actions return 409 without mutation or success audit. Successful actions advance version once, including no-op edits. An identical Idempotency-Key retry returns the original response without reapplying changes.',
  })
  @ApiOkResponse({ type: UserAdministrationDto })
  @ApiConflictResponse({
    description:
      'Stale expected_version, changed keyed payload, or overlapping keyed request.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'A valid expected_version and reason_code are required.',
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.USER_ADMINISTRATION].UPDATE_USERS,
  )
  @EntityIdParam
  public async updateUserById(
    @Param('id', NanoIdParamPipe) id: string,
    @Body() dto: UpdateUserAdministrationDto,
  ): Promise<UserAdministrationDto> {
    return this.svc.updateUser(id, dto);
  }

  // GET /:id
  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID',
    description:
      'Returns a user administration record with identity, profile, roles, permission data and version. Send version as expected_version for updates or deletion.',
  })
  @ApiOkResponse({
    description: 'User record returned successfully.',
    type: UserAdministrationDto,
  })
  @ApiNotFoundResponse({
    description: 'No user was found for the provided ID.',
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.USER_ADMINISTRATION].READ_USERS,
  )
  @EntityIdParam
  public async getUserById(
    @Param('id', NanoIdParamPipe) id: string,
  ): Promise<UserAdministrationDto> {
    return this.svc.findUser(id);
  }

  // GET /:id/activity
  @Get(':id/activity')
  @ApiOperation({
    summary: 'List retained activity for a user',
    description:
      'Returns a paginated audit history whose subject is the selected user, including display-only initiators with current status. This works for tombstoned users; initiating users are distinct from the selected subject.',
  })
  @ApiOkResponse({ type: AuditEventPageDto })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.USER_ADMINISTRATION]
      .READ_ADMINISTRATION_USER_ACTIVITY,
  )
  @EntityIdParam
  public getUserActivity(
    @Param('id', NanoIdParamPipe) id: string,
    @Query() query: UserActivitySearchQueryDto,
  ): Promise<AuditEventPageDto> {
    return this.activity.findForUser(id, query);
  }

  // POST /:id/delete
  @Post(':id/delete')
  @Idempotent('identity.administration.user.delete')
  @Throttle({ default: throttlePolicies.administrationMutation })
  @ApiOperation({
    summary: 'Delete user',
    description:
      'Sets a user account status to deleted using expected_version and a controlled reason. Historical profile fields and relationships are preserved; email is replaced with an internal tombstone address, and credentials, sessions, contacts, and avatar are removed. Stale actions return 409 before cleanup. Soft deletion, durable avatar cleanup intent, and the success audit share the transaction; identical keyed deletion retries replay the original bodyless 204.',
  })
  @ApiConflictResponse({
    description:
      'Stale expected_version, changed keyed payload, or overlapping keyed request.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'A valid expected_version and reason_code are required.',
  })
  @EntityIdParam
  @ApiNoContentResponse({
    description: 'User account deleted successfully.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNotFoundResponse({
    description: 'No user account was found for the provided ID.',
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.USER_ADMINISTRATION].DELETE_USERS,
  )
  public async removeUserById(
    @Param('id', NanoIdParamPipe) id: string,
    @Body() dto: UserAdministrationActionDto,
  ): Promise<void> {
    return this.svc.removeUser(id, dto);
  }
}
