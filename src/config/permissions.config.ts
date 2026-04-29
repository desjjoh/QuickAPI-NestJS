export enum PermissionDomain {
  SYSTEM = 'SYSTEM',
  FRONT_END = 'FRONT_END',
  SELF_MANAGEMENT = 'SELF_MANAGEMENT',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  ROLE_MANAGEMENT = 'ROLE_MANAGEMENT',
  PERMISSION_MANAGEMENT = 'PERMISSION_MANAGEMENT',
  GAME_MANAGEMENT = 'GAME_MANAGEMENT',
  PLATFORM_MANAGEMENT = 'PLATFORM_MANAGEMENT',
  AUDIT_MANAGEMENT = 'AUDIT_MANAGEMENT',
}

// SYSTEM
export enum SystemPermissions {
  HAS_ALL_PERMISSIONS = 'has_all_permissions',
}

// MANAGE ACCOUNT
export enum AccountManagementPermissions {
  READ_ACCOUNT = 'read_account',
  UPDATE_ACCOUNT = 'update_account',
  DELETE_ACCOUNT = 'delete_account',
}

// -- ADMINISTRATION
// USERS
export enum UserManagementPermissions {
  CREATE_USERS = 'create_users',
  READ_USERS = 'read_users',
  UPDATE_USERS = 'update_users',
  DELETE_USERS = 'delete_users',
}

export type PermissionsKey =
  | SystemPermissions
  | AccountManagementPermissions
  | UserManagementPermissions;

export const PERMISSION_MATRIX = {
  [PermissionDomain.SYSTEM]: SystemPermissions,
  [PermissionDomain.SELF_MANAGEMENT]: AccountManagementPermissions,
  [PermissionDomain.USER_MANAGEMENT]: UserManagementPermissions,
};
