import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  PERMISSION_MATRIX,
  PermissionDomain,
  PermissionsKey,
} from '@/config/permissions.config';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { hasProp } from '../helpers/object.helper';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions: PermissionsKey[] =
      this.reflector.get<PermissionsKey[]>(
        PERMISSIONS_KEY,
        context.getHandler(),
      ) || [];

    if (!requiredPermissions.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !hasProp(user, 'userEntity'))
      throw new ForbiddenException('User object could not be found.');

    const { roles } = user.userEntity as UserEntity;

    const userPermissions = Array.from(
      new Set(
        roles?.flatMap((val: RoleEntity) =>
          val.permissions?.map((permission) => permission.key),
        ),
      ),
    );

    const has_all_permissions = userPermissions.includes(
      PERMISSION_MATRIX[PermissionDomain.SYSTEM].HAS_ALL_PERMISSIONS,
    );

    if (has_all_permissions) return true;

    const hasPermission = requiredPermissions.some((permission: string) =>
      userPermissions.includes(permission),
    );

    if (!hasPermission)
      throw new ForbiddenException('Required permission not found.');

    return hasPermission;
  }
}
