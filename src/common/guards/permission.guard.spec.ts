import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  PERMISSION_MATRIX,
  PermissionDomain,
  PermissionsKey,
} from '@/config/permissions.config';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { PermissionEntity } from '@/modules/domain/library/entities/permission.entity';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionsGuard } from './permission.guard';

type MockRequest = {
  user?: unknown;
};

type ReflectorMock = jest.Mocked<Pick<Reflector, 'get'>>;

type MockExecutionContext = ExecutionContext & {
  handler: () => void;
};

const ACCOUNT_UPDATE =
  PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT;

const ACCOUNT_DELETE =
  PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].DELETE_ACCOUNT;

const HAS_ALL_PERMISSIONS =
  PERMISSION_MATRIX[PermissionDomain.SYSTEM].HAS_ALL_PERMISSIONS;

function createExecutionContext(req: MockRequest): MockExecutionContext {
  const handler = jest.fn();

  return {
    handler,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as MockExecutionContext;
}

function createReflectorMock(
  permissions: PermissionsKey[] | undefined,
): ReflectorMock {
  return {
    get: jest.fn().mockReturnValue(permissions),
  };
}

function asReflector(reflector: ReflectorMock): Reflector {
  return reflector as unknown as Reflector;
}

function createPermission(key: PermissionsKey): PermissionEntity {
  return {
    key,
  } as unknown as PermissionEntity;
}

function createRole(permissionKeys: PermissionsKey[]): RoleEntity {
  return {
    permissions: permissionKeys.map(createPermission),
  } as unknown as RoleEntity;
}

function createUserWithPermissions(permissions: PermissionsKey[]): {
  userEntity: Partial<UserEntity>;
} {
  return {
    userEntity: {
      roles: [createRole(permissions)],
    },
  };
}

function createUserWithRoles(roles: RoleEntity[]): {
  userEntity: Partial<UserEntity>;
} {
  return {
    userEntity: {
      roles,
    },
  };
}

describe('PermissionsGuard', () => {
  it('allows request when no permissions are required', async () => {
    const reflector = createReflectorMock(undefined);
    const guard = new PermissionsGuard(asReflector(reflector));

    const context = createExecutionContext({});

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(reflector.get).toHaveBeenCalledWith(
      PERMISSIONS_KEY,
      context.getHandler(),
    );
  });

  it('allows request when required permissions array is empty', async () => {
    const reflector = createReflectorMock([]);
    const guard = new PermissionsGuard(asReflector(reflector));

    const context = createExecutionContext({});

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(reflector.get).toHaveBeenCalledWith(
      PERMISSIONS_KEY,
      context.getHandler(),
    );
  });

  it('throws when permissions are required but request user is missing', async () => {
    const reflector = createReflectorMock([ACCOUNT_UPDATE]);
    const guard = new PermissionsGuard(asReflector(reflector));

    const context = createExecutionContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      'User object could not be found.',
    );
  });

  it('throws when request user does not contain userEntity', async () => {
    const reflector = createReflectorMock([ACCOUNT_UPDATE]);
    const guard = new PermissionsGuard(asReflector(reflector));

    const context = createExecutionContext({
      user: {
        id: 'auth-user-id',
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'User object could not be found.',
    );
  });

  it('allows request when user has one of the required permissions', async () => {
    const reflector = createReflectorMock([ACCOUNT_UPDATE]);
    const guard = new PermissionsGuard(asReflector(reflector));

    const context = createExecutionContext({
      user: createUserWithPermissions([ACCOUNT_UPDATE]),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows request when user has any one of multiple required permissions', async () => {
    const reflector = createReflectorMock([ACCOUNT_UPDATE, ACCOUNT_DELETE]);
    const guard = new PermissionsGuard(asReflector(reflector));

    const context = createExecutionContext({
      user: createUserWithPermissions([ACCOUNT_DELETE]),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('throws when user does not have any required permission', async () => {
    const reflector = createReflectorMock([ACCOUNT_UPDATE]);
    const guard = new PermissionsGuard(asReflector(reflector));

    const context = createExecutionContext({
      user: createUserWithPermissions([ACCOUNT_DELETE]),
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Required permission not found.',
    );
  });

  it('throws when user has roles but no permissions', async () => {
    const reflector = createReflectorMock([ACCOUNT_UPDATE]);
    const guard = new PermissionsGuard(asReflector(reflector));

    const context = createExecutionContext({
      user: createUserWithRoles([
        {
          permissions: [],
        } as unknown as RoleEntity,
      ]),
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Required permission not found.',
    );
  });

  it('throws when user has no roles', async () => {
    const reflector = createReflectorMock([ACCOUNT_UPDATE]);
    const guard = new PermissionsGuard(asReflector(reflector));

    const context = createExecutionContext({
      user: {
        userEntity: {
          roles: [],
        },
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Required permission not found.',
    );
  });

  it('allows request when user has system-wide permission override', async () => {
    const reflector = createReflectorMock([ACCOUNT_UPDATE]);
    const guard = new PermissionsGuard(asReflector(reflector));

    const context = createExecutionContext({
      user: createUserWithPermissions([HAS_ALL_PERMISSIONS]),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('deduplicates permissions from multiple roles and still allows access', async () => {
    const reflector = createReflectorMock([ACCOUNT_UPDATE]);
    const guard = new PermissionsGuard(asReflector(reflector));

    const context = createExecutionContext({
      user: createUserWithRoles([
        createRole([ACCOUNT_UPDATE]),
        createRole([ACCOUNT_UPDATE]),
      ]),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('looks up permissions using the permissions metadata key and current handler', async () => {
    const reflector = createReflectorMock([ACCOUNT_UPDATE]);
    const guard = new PermissionsGuard(asReflector(reflector));

    const context = createExecutionContext({
      user: createUserWithPermissions([ACCOUNT_UPDATE]),
    });

    await guard.canActivate(context);

    expect(reflector.get).toHaveBeenCalledWith(
      PERMISSIONS_KEY,
      context.getHandler(),
    );
  });
});
