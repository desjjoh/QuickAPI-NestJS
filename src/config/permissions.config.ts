export enum PermissionDomain {
  SYSTEM = 'SYSTEM',
  ACCOUNT_MANAGEMENT = 'ACCOUNT_MANAGEMENT',
  ARTICLE_CREATOR = 'ARTICLE_CREATOR',
  ARTICLE_ADMINISTRATION = 'ARTICLE_ADMINISTRATION',
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

// ARTICLES
export enum ArticleCreatorPermissions {
  CREATE_ARTICLES = 'create_articles',
  READ_OWN_ARTICLES = 'read_own_articles',
  UPDATE_OWN_ARTICLES = 'update_own_articles',
  SUBMIT_OWN_ARTICLES = 'submit_own_articles',
  WITHDRAW_OWN_ARTICLES = 'withdraw_own_articles',
}

export enum ArticleAdministrationPermissions {
  READ_ARTICLES = 'read_articles',
  PUBLISH_ARTICLES = 'publish_articles',
  RETURN_ARTICLES_TO_DRAFT = 'return_articles_to_draft',
  ARCHIVE_ARTICLES = 'archive_articles',
  RESTORE_ARTICLES = 'restore_articles',
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
  | ArticleCreatorPermissions
  | ArticleAdministrationPermissions
  | UserAdministrationPermissions
  | AuditPermissions;

export const PERMISSION_MATRIX = {
  [PermissionDomain.SYSTEM]: SystemPermissions,
  [PermissionDomain.ACCOUNT_MANAGEMENT]: AccountManagementPermissions,
  [PermissionDomain.ARTICLE_CREATOR]: ArticleCreatorPermissions,
  [PermissionDomain.ARTICLE_ADMINISTRATION]: ArticleAdministrationPermissions,
  [PermissionDomain.USER_ADMINISTRATION]: UserAdministrationPermissions,
  [PermissionDomain.AUDIT]: AuditPermissions,
};
