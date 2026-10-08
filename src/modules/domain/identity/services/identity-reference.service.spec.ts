import { InternalServerErrorException } from '@nestjs/common';

import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';
import { ROLE_KEYS } from '@/modules/domain/library/seeders/role.seeder';

import { IdentityReferenceService } from './identity-reference.service';

describe('IdentityReferenceService', () => {
  const manager = { id: 'manager' };
  const roles = { manager, findByKey: jest.fn() };
  const statuses = { manager, findByKey: jest.fn() };
  let service: IdentityReferenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    roles.findByKey.mockResolvedValue({ id: 'role-1', key: ROLE_KEYS.USER });
    statuses.findByKey.mockResolvedValue({
      id: 'status-1',
      key: ACCOUNT_STATUS_KEYS.ACTIVE,
    });
    service = new IdentityReferenceService(roles as never, statuses as never);
  });

  it('resolves seeded account statuses and roles through the selected manager', async () => {
    await expect(
      service.getAccountStatus(ACCOUNT_STATUS_KEYS.ACTIVE, manager as never),
    ).resolves.toEqual({ id: 'status-1', key: ACCOUNT_STATUS_KEYS.ACTIVE });
    await expect(
      service.getRole(ROLE_KEYS.USER, manager as never),
    ).resolves.toEqual({ id: 'role-1', key: ROLE_KEYS.USER });

    expect(statuses.findByKey).toHaveBeenCalledWith(
      manager,
      ACCOUNT_STATUS_KEYS.ACTIVE,
    );
    expect(roles.findByKey).toHaveBeenCalledWith(manager, ROLE_KEYS.USER);
  });

  it('fails loudly when a required status seed is missing', async () => {
    statuses.findByKey.mockResolvedValue(null);

    await expect(
      service.getAccountStatus(ACCOUNT_STATUS_KEYS.ACTIVE),
    ).rejects.toThrow('Account status "active" is not seeded.');
    await expect(
      service.getAccountStatus(ACCOUNT_STATUS_KEYS.ACTIVE),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('fails loudly when a required role seed is missing', async () => {
    roles.findByKey.mockResolvedValue(null);

    await expect(service.getRole(ROLE_KEYS.USER)).rejects.toThrow(
      'Role "user" is not seeded.',
    );
  });
});
