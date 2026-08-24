import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';

const timestamp = (value: Date | null | undefined): string | null =>
  value instanceof Date ? value.toISOString() : null;

/** Builds a detached, policy-shaped user value at the mutation boundary. */
export const identityUserSnapshot = (
  user: UserEntity,
): Record<string, unknown> => ({
  id: user.id,
  identity: { email: user.identity.email },
  profile: {
    id: user.profile.id,
    name: {
      first: user.profile.name.first,
      last: user.profile.name.last,
    },
  },
  roles: (user.roles ?? []).map(({ id }) => id),
  status: {
    id: user.status.id ?? null,
    key: user.status.key,
    label: user.status.label,
  },
  created_at: timestamp(user.createdAt),
  updated_at: timestamp(user.updatedAt),
  metadata: {
    last_sign_in: timestamp(user.metadata.last_sign_in),
    mfa_enabled: user.metadata.mfa_enabled,
  },
});

/** Builds a detached session value without refresh tokens or network addresses. */
export const identitySessionSnapshot = (
  session: UserSessionEntity,
  userId?: string,
): Record<string, unknown> => ({
  id: session.id,
  user_id: session.user?.id ?? userId ?? null,
  active: session.active,
  browser: session.browser,
  browser_version: session.browser_version,
  device: session.device,
  os: session.os,
  os_version: session.os_version,
  user_agent: session.user_agent,
  created_at: timestamp(session.createdAt),
  updated_at: timestamp(session.updatedAt),
});
