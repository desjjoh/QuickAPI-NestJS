import { AccountTokenType } from '@/config/token.config';
import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';
import { AccountTokenEntity } from '@/modules/domain/identity/entities/account-token.entity';
import {
  MfaMethod,
  UserMfaSettingsEntity,
} from '@/modules/domain/identity/entities/mfa.entity';
import { UserProfileEntity } from '@/modules/domain/identity/entities/profile.entity';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { AccountStatusEntity } from '@/modules/domain/library/entities/accountstatus.entity';
import { PermissionEntity } from '@/modules/domain/library/entities/permission.entity';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';

export const TEST_NOW = new Date('2025-01-02T03:04:05.000Z');

type EntityOverrides<TEntity> = Partial<TEntity>;

const entity = <TEntity extends object>(
  EntityType: new () => TEntity,
  defaults: EntityOverrides<TEntity>,
  overrides: EntityOverrides<TEntity>,
): TEntity => Object.assign(new EntityType(), defaults, overrides);

export const buildPermission = (
  overrides: EntityOverrides<PermissionEntity> = {},
): PermissionEntity =>
  entity(
    PermissionEntity,
    {
      id: 'permission-1',
      key: 'read_users',
      label: 'Read users',
      description: null,
      roles: [],
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    },
    overrides,
  );

export const buildRole = (
  overrides: EntityOverrides<RoleEntity> = {},
): RoleEntity =>
  entity(
    RoleEntity,
    {
      id: 'role-1',
      key: 'member',
      label: 'Member',
      description: null,
      users: [],
      permissions: [],
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    },
    overrides,
  );

export const buildAccountStatus = (
  overrides: EntityOverrides<AccountStatusEntity> = {},
): AccountStatusEntity =>
  entity(
    AccountStatusEntity,
    {
      id: 'status-1',
      key: ACCOUNT_STATUS_KEYS.ACTIVE,
      label: 'Active',
      description: null,
      users: [],
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    },
    overrides,
  );

export const buildProfile = (
  overrides: EntityOverrides<UserProfileEntity> = {},
): UserProfileEntity =>
  entity(
    UserProfileEntity,
    {
      id: 'profile-1',
      name: { first: 'Test', last: 'User', preferred: null },
      contact: { phone: null, address: null },
      media: { avatar: null },
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    },
    overrides,
  );

export const buildUser = (
  overrides: EntityOverrides<UserEntity> = {},
): UserEntity =>
  entity(
    UserEntity,
    {
      id: 'user-1',
      identity: { email: 'user@example.test', password: 'password-hash' },
      profile: buildProfile(),
      status: buildAccountStatus(),
      roles: [],
      sessions: [],
      account_tokens: [],
      mfa_settings: null,
      metadata: {
        last_sign_in: null,
        last_changed_email: null,
        last_changed_password: null,
        last_updated_at: null,
        mfa_enabled: false,
      },
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    },
    overrides,
  );

export const buildActiveUser = (
  overrides: EntityOverrides<UserEntity> = {},
): UserEntity => buildUser(overrides);

export const buildInactiveUser = (
  overrides: EntityOverrides<UserEntity> = {},
): UserEntity =>
  buildUser({
    status: buildAccountStatus({
      key: ACCOUNT_STATUS_KEYS.DISABLED,
      label: 'Disabled',
    }),
    ...overrides,
  });

export const buildVerifiedUser = (
  overrides: EntityOverrides<UserEntity> = {},
): UserEntity =>
  buildUser({
    metadata: {
      ...buildUser().metadata,
      last_sign_in: TEST_NOW,
    },
    ...overrides,
  });

export const buildUnverifiedUser = (
  overrides: EntityOverrides<UserEntity> = {},
): UserEntity => buildUser(overrides);

export const buildMfaSettings = (
  overrides: EntityOverrides<UserMfaSettingsEntity> = {},
): UserMfaSettingsEntity =>
  entity(
    UserMfaSettingsEntity,
    {
      id: 'mfa-1',
      enabled: true,
      primary_method: MfaMethod.EMAIL_OTP,
      enabled_at: TEST_NOW,
      disabled_at: null,
      last_verified_at: TEST_NOW,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    },
    overrides,
  );

export const buildMfaEnabledUser = (
  overrides: EntityOverrides<UserEntity> = {},
): UserEntity => {
  const user = buildUser({
    metadata: { ...buildUser().metadata, mfa_enabled: true },
    ...overrides,
  });
  const settings = buildMfaSettings({ user });

  return entity(UserEntity, user, { mfa_settings: settings });
};

export const buildSession = (
  overrides: EntityOverrides<UserSessionEntity> = {},
): UserSessionEntity =>
  entity(
    UserSessionEntity,
    {
      id: 'session-1',
      user: buildUser(),
      refresh: 'refresh-token-hash',
      token_version: 0,
      active: true,
      browser: null,
      browser_version: null,
      device: null,
      os: null,
      os_version: null,
      ip_address: null,
      user_agent: null,
      origin: null,
      location: {
        country_code: null,
        country_name: null,
        region_code: null,
        region_name: null,
        city: null,
        source: null,
        resolved_at: null,
      },
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    },
    overrides,
  );

export const buildAccountToken = (
  overrides: EntityOverrides<AccountTokenEntity> = {},
): AccountTokenEntity =>
  entity(
    AccountTokenEntity,
    {
      id: 'account-token-1',
      user: buildUser(),
      type: AccountTokenType.EMAIL_VERIFICATION,
      token_hash: 'token-hash',
      expires_at: new Date('2025-01-02T03:19:05.000Z'),
      consumed_at: null,
      mfa_code_hash: null,
      failed_attempts: 0,
      locked_at: null,
      metadata: null,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    },
    overrides,
  );
