export const ACCOUNT_STATUS_KEYS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
  LOCKED: 'locked',
  DELETED: 'deleted',
} as const;

export type AccountStatusKey =
  (typeof ACCOUNT_STATUS_KEYS)[keyof typeof ACCOUNT_STATUS_KEYS];

export interface AccountStatusSeed {
  key: AccountStatusKey;
  label: string;
  description: string;
}

export const ACCOUNT_STATUSES: AccountStatusSeed[] = [
  {
    key: ACCOUNT_STATUS_KEYS.DELETED,
    label: 'Deleted',
    description:
      'The account is permanently soft deleted and cannot authenticate or be reactivated.',
  },
  {
    key: ACCOUNT_STATUS_KEYS.ACTIVE,
    label: 'Active',
    description: 'The account is active and may authenticate normally.',
  },
  {
    key: ACCOUNT_STATUS_KEYS.DISABLED,
    label: 'Disabled',
    description:
      'The account has been disabled by an administrator and may not authenticate.',
  },
  {
    key: ACCOUNT_STATUS_KEYS.LOCKED,
    label: 'Locked',
    description:
      'The account is temporarily locked due to security or policy reasons.',
  },
];
