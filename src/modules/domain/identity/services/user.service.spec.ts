jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';
import { ROLE_KEYS } from '../../library/seeders/role.seeder';
import { UserService } from './user.service';

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

describe('UserService', () => {
  const user = {
    id: 'u1',
    identity: { email: 'user@test.dev', password: 'stored-hash' },
    status: { key: ACCOUNT_STATUS_KEYS.ACTIVE },
    roles: [],
    metadata: {},
  };
  const manager = { delete: jest.fn() };
  const userRepo = {
    findByEmail: jest.fn(),
    findByIdOrFail: jest.fn(),
    merge: jest.fn(),
    save: jest.fn(),
    createUser: jest.fn(),
    removeUser: jest.fn(),
    clearProfileAvatar: jest.fn(),
    incrementTokenVersion: jest.fn(),
    manager,
  };
  const roleRepo = { findOne: jest.fn() };
  const statusRepo = { findOne: jest.fn() };
  let service: UserService;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo.findByEmail.mockResolvedValue(user);
    userRepo.findByIdOrFail.mockResolvedValue(user);
    userRepo.merge.mockImplementation((base, dto) => ({ ...base, ...dto }));
    userRepo.createUser.mockResolvedValue(user);
    statusRepo.findOne.mockResolvedValue({
      id: 'active',
      key: ACCOUNT_STATUS_KEYS.ACTIVE,
    });
    roleRepo.findOne.mockResolvedValue({ id: 'role', key: ROLE_KEYS.USER });
    service = new UserService(
      userRepo as never,
      roleRepo as never,
      statusRepo as never,
    );
  });

  it('compares password hashes and returns a valid user', async () => {
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
    await expect(service.validateUser('user@test.dev', 'plain')).resolves.toBe(
      user,
    );
    expect(bcrypt.compare).toHaveBeenCalledWith('plain', 'stored-hash');
  });

  it.each([
    ['missing user', null, true],
    ['missing password', { identity: {} }, true],
    ['incorrect password', user, false],
  ])('rejects invalid credentials for %s', async (_label, found, match) => {
    userRepo.findByEmail.mockResolvedValue(found);
    jest.mocked(bcrypt.compare).mockResolvedValue(match as never);
    await expect(service.validateUser('x', 'bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('hashes passwords with cost 12', async () => {
    jest.mocked(bcrypt.hash).mockResolvedValue('secure-hash' as never);
    await expect(service.hashPassword('plain')).resolves.toBe('secure-hash');
    expect(bcrypt.hash).toHaveBeenCalledWith('plain', 12);
  });

  it('checks permissions and account activity', () => {
    const permitted = { ...user, roles: [{ permissions: [{ key: 'read' }] }] };
    expect(() =>
      service.hasPermission(permitted as never, ['write', 'read']),
    ).not.toThrow();
    expect(() => service.hasPermission(user as never, ['read'])).toThrow(
      ForbiddenException,
    );
    expect(service.canAuthenticate(user as never)).toBe(true);
    service.assertCanAuthenticate(user as never);
    expect(() =>
      service.assertCanAuthenticate({
        ...user,
        status: { key: 'disabled' },
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('delegates address, phone, avatar, and lookup operations', async () => {
    await service.deleteAddress({ id: 'a1' } as never);
    await service.deletePhone({ id: 'p1' } as never);
    await service.clearProfileAvatar('profile');
    await expect(service.findByIdOrFail('u1')).resolves.toBe(user);
    expect(manager.delete).toHaveBeenCalledTimes(2);
    expect(userRepo.clearProfileAvatar).toHaveBeenCalledWith('profile');
  });

  it('updates users and touches metadata unless explicitly disabled', async () => {
    await service.updateUser(user as never, {
      identity: { email: 'new@test.dev' },
    });
    expect(userRepo.merge).toHaveBeenCalledWith(
      user,
      expect.objectContaining({
        metadata: expect.objectContaining({
          last_updated_at: expect.any(Date),
        }),
      }),
    );
    await service.updateUser(
      user as never,
      { metadata: { last_sign_in: null } } as never,
      { touchLastUpdatedAt: false },
    );
    expect(userRepo.merge).toHaveBeenLastCalledWith(
      user,
      expect.objectContaining({ metadata: { last_sign_in: null } }),
    );
  });

  it('records sign-in, email-change, and password-change metadata', async () => {
    await service.recordSignIn(user as never);
    await service.recordEmailChanged(user as never);
    await service.recordPasswordChanged(user as never);
    const merged = userRepo.merge.mock.calls.map((call) => call[1].metadata);
    expect(merged[0].last_sign_in).toBeInstanceOf(Date);
    expect(merged[1].last_changed_email).toBeInstanceOf(Date);
    expect(merged[2].last_changed_password).toBeInstanceOf(Date);
  });

  it('deletes a user and clears the refresh cookie', async () => {
    const res = { clearCookie: jest.fn() };
    await service.deleteUser(user as never, res as never);
    expect(userRepo.removeUser).toHaveBeenCalledWith('u1');
    expect(res.clearCookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
    );
  });

  it('creates a user with seeded defaults and rejects duplicate email', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    await service.createUser({ identity: { email: 'new@test.dev' } });
    expect(userRepo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { id: 'active' },
        roles: [{ id: 'role', key: ROLE_KEYS.USER }],
        metadata: expect.any(Object),
      }),
    );
    userRepo.findByEmail.mockResolvedValue(user);
    await expect(
      service.createUser({ identity: { email: 'user@test.dev' } }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each(['email', 'status', 'role'])(
    'rejects creation with missing %s seed/input',
    async (part) => {
      userRepo.findByEmail.mockResolvedValue(null);
      if (part === 'status') statusRepo.findOne.mockResolvedValue(null);
      if (part === 'role') roleRepo.findOne.mockResolvedValue(null);
      const input =
        part === 'email' ? {} : { identity: { email: 'new@test.dev' } };
      await expect(service.createUser(input)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    },
  );

  it('updates status, increments token version, and adds roles idempotently', async () => {
    await service.updateUserStatusByKey(
      user as never,
      ACCOUNT_STATUS_KEYS.ACTIVE,
    );
    expect(userRepo.incrementTokenVersion).toHaveBeenCalledWith('u1');
    await service.addUserRoleByKey(user as never, ROLE_KEYS.USER);
    expect(userRepo.save).toHaveBeenCalled();
    const withRole = { ...user, roles: [{ key: ROLE_KEYS.USER }] };
    await expect(
      service.addUserRoleByKey(withRole as never, ROLE_KEYS.USER),
    ).resolves.toBe(withRole);
  });

  it('rejects missing status and role lookup keys', async () => {
    statusRepo.findOne.mockResolvedValue(null);
    await expect(
      service.updateUserStatusByKey(user as never, ACCOUNT_STATUS_KEYS.ACTIVE),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    roleRepo.findOne.mockResolvedValue(null);
    await expect(
      service.addUserRoleByKey(user as never, ROLE_KEYS.USER),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
