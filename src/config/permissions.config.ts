export enum PermissionDomain {
  SYSTEM = 'SYSTEM',
  ACCOUNT_MANAGEMENT = 'ACCOUNT_MANAGEMENT',
  USER_ADMINISTRATION = 'USER_ADMINISTRATION',
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
export enum UserAdministrationPermissions {
  CREATE_USERS = 'create_users',
  READ_USERS = 'read_users',
  UPDATE_USERS = 'update_users',
  DELETE_USERS = 'delete_users',
}

export type PermissionsKey =
  | SystemPermissions
  | AccountManagementPermissions
  | UserAdministrationPermissions;

export const PERMISSION_MATRIX = {
  [PermissionDomain.SYSTEM]: SystemPermissions,
  [PermissionDomain.ACCOUNT_MANAGEMENT]: AccountManagementPermissions,
  [PermissionDomain.USER_ADMINISTRATION]: UserAdministrationPermissions,
};
