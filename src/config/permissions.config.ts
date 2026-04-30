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

export const PERMISSION_MATRIX = {
  SYSTEM: SystemPermissions,
  ACCOUNT_MANAGEMENT: AccountManagementPermissions,
  USER_MANAGEMENT: UserManagementPermissions,
};
