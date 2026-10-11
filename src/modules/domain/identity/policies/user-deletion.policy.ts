import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';

/** Status is authoritative. Names and timestamps are never deletion predicates. */
export function isUserDeleted(user: {
  status?: { key?: string } | null;
}): boolean {
  return user.status?.key === ACCOUNT_STATUS_KEYS.DELETED;
}
