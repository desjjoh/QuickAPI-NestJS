export enum PermissionDomain {
  SYSTEM = 'SYSTEM',
  ACCOUNT_MANAGEMENT = 'ACCOUNT_MANAGEMENT',
  USER_ADMINISTRATION = 'USER_ADMINISTRATION',
  AUDIT = 'AUDIT',
}

// SYSTEM
export enum SystemPermissions {
  HAS_ALL_PERMISSIONS = 'has_all_permissions',
}

// MANAGE ACCOUNT
export enum AccountManagementPermissions {
  UPDATE_ACCOUNT = 'update_account',
  DELETE_ACCOUNT = 'delete_account',
  READ_CURRENT_USER_ACTIVITY = 'read_current_user_activity',
}

// -- ADMINISTRATION
// USERS
export enum UserAdministrationPermissions {
  CREATE_USERS = 'create_users',
  READ_USERS = 'read_users',
  UPDATE_USERS = 'update_users',
  DELETE_USERS = 'delete_users',
  READ_ADMINISTRATION_USER_ACTIVITY = 'read_administration_user_activity',
}

export enum AuditPermissions {
  SEARCH_AUDIT = 'search_audit',
  READ_AUDIT_DETAIL = 'read_audit_detail',
  EXPORT_AUDIT = 'export_audit',
}

export type PermissionsKey =
  | SystemPermissions
  | AccountManagementPermissions
  | UserAdministrationPermissions
  | AuditPermissions;

export const PERMISSION_MATRIX = {
  [PermissionDomain.SYSTEM]: SystemPermissions,
  [PermissionDomain.ACCOUNT_MANAGEMENT]: AccountManagementPermissions,
  [PermissionDomain.USER_ADMINISTRATION]: UserAdministrationPermissions,
  [PermissionDomain.AUDIT]: AuditPermissions,
};
