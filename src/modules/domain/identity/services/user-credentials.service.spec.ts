jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';

import { UserCredentialsService } from './user-credentials.service';

describe('UserCredentialsService', () => {
  const manager = { id: 'manager' };
  const user = {
    id: 'user-1',
    identity: { email: 'user@example.test', password: 'stored-hash' },
    status: { key: ACCOUNT_STATUS_KEYS.ACTIVE },
    metadata: {},
  };
  const users = {
    findByEmail: jest.fn(),
    findByIdOrFail: jest.fn(),
    updateUser: jest.fn(),
  };
  const repository = { manager };
  let service: UserCredentialsService;

  beforeEach(() => {
    jest.clearAllMocks();
    users.findByEmail.mockResolvedValue(user);
    users.findByIdOrFail.mockResolvedValue(user);
    users.updateUser.mockResolvedValue(user);
    service = new UserCredentialsService(users as never, repository as never);
  });

  it('validates a password against the stored hash with the selected manager', async () => {
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);

    await expect(
      service.validateUser('user@example.test', 'plain', manager as never),
    ).resolves.toBe(user);

    expect(users.findByEmail).toHaveBeenCalledWith(
      'user@example.test',
      manager,
    );
    expect(bcrypt.compare).toHaveBeenCalledWith('plain', 'stored-hash');
  });

  it.each([
    ['missing user', null, true],
    ['missing password', { identity: {} }, true],
    ['incorrect password', user, false],
  ])('rejects invalid credentials for %s', async (_case, found, matches) => {
    users.findByEmail.mockResolvedValue(found);
    jest.mocked(bcrypt.compare).mockResolvedValue(matches as never);

    await expect(
      service.validateUser('user@example.test', 'bad'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('hashes passwords with the configured work factor', async () => {
    jest.mocked(bcrypt.hash).mockResolvedValue('new-hash' as never);

    await expect(service.hashPassword('plain')).resolves.toBe('new-hash');
    expect(bcrypt.hash).toHaveBeenCalledWith('plain', 12);
  });

  it('accepts only active accounts for authentication', () => {
    expect(service.canAuthenticate(user as never)).toBe(true);
    expect(() => service.assertCanAuthenticate(user as never)).not.toThrow();
    expect(() =>
      service.assertCanAuthenticate({
        ...user,
        status: { key: 'disabled' },
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('records each security timestamp through the immutable user update path', async () => {
    await service.recordSignIn(user as never, manager as never);
    await service.recordEmailChanged(user as never, manager as never);
    await service.recordPasswordChanged(user as never, manager as never);
    await service.recordMfaChanged(user as never, true, manager as never);

    expect(users.findByIdOrFail).toHaveBeenCalledTimes(4);
    expect(users.findByIdOrFail).toHaveBeenCalledWith('user-1', manager);
    const metadata = users.updateUser.mock.calls.map(
      (call) => call[1].metadata,
    );
    expect(metadata[0].last_sign_in).toBeInstanceOf(Date);
    expect(metadata[1].last_changed_email).toBeInstanceOf(Date);
    expect(metadata[2].last_changed_password).toBeInstanceOf(Date);
    expect(metadata[3]).toEqual(
      expect.objectContaining({
        last_changed_mfa: expect.any(Date),
        mfa_enabled: true,
      }),
    );
    expect(users.updateUser).toHaveBeenLastCalledWith(
      user,
      expect.any(Object),
      {},
      manager,
    );
  });
});
