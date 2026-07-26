import type { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import type { UserEntity } from '@/modules/domain/identity/entities/user.entity';

const timestamp = new Date('2026-01-02T03:04:05.000Z');

export const sessionFixture = (
  overrides: Record<string, unknown> = {},
): UserSessionEntity =>
  ({
    id: 'session-1',
    createdAt: timestamp,
    updatedAt: timestamp,
    active: true,
    browser: 'Firefox',
    browser_version: '128',
    device: 'Desktop',
    os: 'Linux',
    os_version: '6',
    ip_address: '127.0.0.1',
    location: {
      country_code: 'CA',
      country_name: 'Canada',
      region_code: 'ON',
      region_name: 'Ontario',
      city: 'Ottawa',
      source: 'test',
      resolved_at: timestamp,
    },
    user_agent: 'test-agent',
    origin: 'https://example.test',
    ...overrides,
  }) as unknown as UserSessionEntity;

export const userFixture = (
  overrides: Record<string, unknown> = {},
): UserEntity =>
  ({
    id: 'user-1',
    createdAt: timestamp,
    updatedAt: timestamp,
    identity: { email: 'person@example.test', password: 'hash' },
    profile: {
      id: 'profile-1',
      name: { first: 'Pat', last: 'Person', preferred: 'P' },
      personal: {
        bio: null,
        dob: '1990-01-01',
        gender: { key: 'unspecified', label: 'Unspecified' },
      },
      contact: { phone: null, address: null },
      region: {
        country: {
          id: 'country-1',
          createdAt: timestamp,
          updatedAt: timestamp,
          key: 'canada',
          label: 'Canada',
          iso2: 'CA',
          iso3: 'CAN',
          flag_url: '/flags/ca.svg',
          regions: [],
          calling_code: '1',
          phone_national_placeholder: '5555555555',
          phone_national_pattern: '\\d+',
          phone_format_groups: [3, 3, 4],
          postal_code_placeholder: 'K1A 0B1',
          postal_code_pattern: '.*',
          postal_code_format_groups: [3, 3],
          postal_code_format_separator: ' ',
        },
        timezone: {
          id: 'timezone-1',
          createdAt: timestamp,
          updatedAt: timestamp,
          key: 'America/Toronto',
          label: 'Eastern',
          long_name: 'Eastern Time',
          region: 'America',
          exemplar_city: 'Toronto',
        },
      },
      media: { avatar: null },
    },
    metadata: {
      last_sign_in: null,
      last_changed_email: null,
      last_changed_password: null,
      last_updated_at: null,
      mfa_enabled: false,
    },
    roles: [],
    status: { key: 'active', label: 'Active' },
    ...overrides,
  }) as unknown as UserEntity;
