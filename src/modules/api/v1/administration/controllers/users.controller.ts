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
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { EntityIdParam } from '@/common/decorators/id-param.decorator';
import { NanoIdParamPipe } from '@/common/pipes/nanoid.pipe';
import { UserAdminService } from '../service/users.service';
import { throttlePolicies } from '@/config/throttle-policy.config';
import { Throttle } from '@nestjs/throttler';
import { UpdateUserAdministrationDto } from '../models/update-user.model';

@ApiPlatformAdmin()
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
@Throttle({ default: throttlePolicies.administrationRead })
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

  @Patch(':id')
  @Throttle({ default: throttlePolicies.administrationMutation })
  @ApiOperation({ summary: 'Update a user account' })
  @ApiOkResponse({ type: UserDto })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.USER_ADMINISTRATION].UPDATE_USERS,
  )
  @EntityIdParam
  public async updateUserById(
    @Param('id', NanoIdParamPipe) id: string,
    @Body() dto: UpdateUserAdministrationDto,
  ): Promise<UserDto> {
    return this.svc.updateUser(id, dto);
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

  // DELETE /:id
  @Delete(':id')
  @Throttle({ default: throttlePolicies.administrationMutation })
  @ApiOperation({
    summary: 'Delete user',
    description:
      'Permanently deletes a user account by ID through user administration. This operation performs account cleanup before deletion, including removal of account-owned profile resources such as avatar and address data where applicable.',
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
  ): Promise<void> {
    return this.svc.removeUser(id);
  }
}
