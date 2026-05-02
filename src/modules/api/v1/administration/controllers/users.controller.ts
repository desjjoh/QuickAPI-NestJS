import { ApiPlatformAdmin } from '@/common/decorators/platform-admin.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import {
  PaginationDto,
  PaginationMeta,
} from '@/common/models/pagination.model';
import {
  PERMISSION_MATRIX,
  PermissionDomain,
} from '@/config/permissions.config';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import {
  UserDto,
  UserPaginationOptions,
} from '@/modules/domain/identity/models/user.model';
import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiPlatformAdmin()
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UserAdministrationController {
  public constructor(private readonly repo: UserRepository) {}

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
    @Query() params: UserPaginationOptions,
  ): Promise<PaginationDto<UserDto>> {
    const [response, itemCount] = await this.repo.paginate(params);

    const users: UserDto[] = response.map((e: UserEntity) => new UserDto(e));
    const meta: PaginationMeta = new PaginationMeta({
      pageOptions: params,
      itemCount,
    });

    return new PaginationDto(users, meta);
  }
}
