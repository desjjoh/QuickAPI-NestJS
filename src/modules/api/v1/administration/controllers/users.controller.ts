import { ApiPlatformAdmin } from '@/common/decorators/platform-admin.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import { PaginationDto } from '@/common/models/pagination.model';
import {
  PERMISSION_MATRIX,
  PermissionDomain,
} from '@/config/permissions.config';
import {
  UserDto,
  UserPaginationOptions,
} from '@/modules/domain/identity/models/user.model';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { EntityIdParam } from '@/common/decorators/id-param.decorator';
import { NanoIdParamPipe } from '@/common/pipes/nanoid.pipe';
import { UserAdminService } from '../service/users.service';

@ApiPlatformAdmin()
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UserAdministrationController {
  public constructor(private readonly svc: UserAdminService) {}

  // GET /
  @Get('')
  @ApiOperation({
    summary: 'List paginated users',
    description:
      'Returns a paginated set of user account records for administration, including identity, profile, roles, and permission data. Supports pagination, sorting, and search through query parameters.',
  })
  @ApiOkResponse({
    description: 'Paginated user records returned successfully.',
    type: PaginationDto<UserDto>,
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.USER_ADMINISTRATION].READ_USERS,
  )
  public async getPaginatedUsers(
    @Query() pageOptions: UserPaginationOptions,
  ): Promise<PaginationDto<UserDto>> {
    return this.svc.paginateUsers(pageOptions);
  }

  // GET /:id
  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID',
    description:
      'Returns a single user account record for administration, including identity, profile, roles, and permission data.',
  })
  @ApiOkResponse({
    description: 'User record returned successfully.',
    type: UserDto,
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
  ): Promise<UserDto> {
    return this.svc.findUser(id);
  }
}
