jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';

import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';
import { AccountTokenType } from '@/config/token.config';
import { AccountStatusEntity } from '../../library/entities/accountstatus.entity';
import { ROLE_KEYS } from '../../library/seeders/role.seeder';
import { UserEntity } from '../entities/user.entity';
import { EmailVerificationService } from './email-verification.service';

describe('EmailVerificationService', () => {
  const user = {
    id: 'u1',
    identity: { email: 'old@test.dev', password: 'hash' },
    profile: { name: { first: 'Ada', preferred: null } },
    status: { key: ACCOUNT_STATUS_KEYS.ACTIVE },
    roles: [],
    metadata: {},
  };
  const repo = { findByEmail: jest.fn(), incrementTokenVersion: jest.fn() };
  const accountTokens = { createToken: jest.fn(), consumeMfaCode: jest.fn() };
  const registrationTokens = {
    createToken: jest.fn(),
    consumeVerificationCode: jest.fn(),
  };
  const userSvc = {
    canAuthenticate: jest.fn(),
    addUserRoleByKey: jest.fn(),
    updateUser: jest.fn(),
    recordEmailChanged: jest.fn(),
  };
  const emailSvc = { sendEmail: jest.fn() };
  const users = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
  };
  const statuses = { findOne: jest.fn() };
  const roles = { findOne: jest.fn() };
  const query = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    execute: jest.fn(),
  };
  const manager = { getRepository: jest.fn(), createQueryBuilder: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  let service: EmailVerificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.findByEmail.mockResolvedValue(null);
    userSvc.canAuthenticate.mockReturnValue(true);
    accountTokens.createToken.mockResolvedValue({
      id: 'v1',
      token: 'opaque',
      expires_at: new Date(),
    });
    registrationTokens.createToken.mockResolvedValue({
      id: 'r1',
      token: 'opaque',
      expires_at: new Date(),
    });
    users.create.mockImplementation((x) => x);
    users.merge.mockImplementation((base, dto) => ({ ...base, ...dto }));
    users.save.mockImplementation(async (x) => ({
      id: x.id ?? 'new-user',
      ...x,
    }));
    statuses.findOne.mockResolvedValue({
      id: 'active',
      key: ACCOUNT_STATUS_KEYS.ACTIVE,
    });
    roles.findOne.mockResolvedValue({ id: 'role', key: ROLE_KEYS.USER });
    manager.getRepository.mockImplementation((entity) =>
      entity === UserEntity
        ? users
        : entity === AccountStatusEntity
          ? statuses
          : roles,
    );
    query.update.mockReturnValue(query);
    query.set.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.execute.mockResolvedValue({ affected: 1 });
    manager.createQueryBuilder.mockReturnValue(query);
    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager),
    );
    service = new EmailVerificationService(
      repo as never,
      accountTokens as never,
      registrationTokens as never,
      userSvc as never,
      emailSvc as never,
      dataSource as never,
    );
  });

  it('sends initial verification while storing only the MFA hash', async () => {
    await service.sendVerificationEmail(user as never);
    const creation = accountTokens.createToken.mock.calls[0][0];
    const code = emailSvc.sendEmail.mock.calls[0][0].model.mfaCode;
    expect(creation.type).toBe(AccountTokenType.EMAIL_VERIFICATION);
    expect(creation.mfaCodeHash).toBe(
      createHash('sha256').update(code).digest('hex'),
    );
    expect(creation.mfaCodeHash).not.toBe(code);
  });

  it('normalizes and sends an email-change challenge', async () => {
    await service.sendEmailChangeVerification(user as never, ' NEW@Test.Dev ');
    expect(accountTokens.createToken).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { newEmail: 'new@test.dev' } }),
    );
    expect(emailSvc.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'new@test.dev' }),
    );
  });

  it('rejects unchanged and colliding email changes', async () => {
    await expect(
      service.sendEmailChangeVerification(user as never, 'OLD@test.dev'),
    ).rejects.toBeInstanceOf(BadRequestException);
    repo.findByEmail.mockResolvedValue({ id: 'other' });
    await expect(
      service.sendEmailChangeVerification(user as never, 'taken@test.dev'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('sends registration verification with a hashed code', async () => {
    const metadata = {
      email: 'new@test.dev',
      password: 'password-hash',
      profile: { name: { first: 'New', preferred: null } },
    };
    await service.sendRegistrationVerificationEmail(
      'new@test.dev',
      metadata as never,
    );
    const creation = registrationTokens.createToken.mock.calls[0][0];
    const code = emailSvc.sendEmail.mock.calls[0][0].model.mfaCode;
    expect(creation.mfaCodeHash).toBe(
      createHash('sha256').update(code).digest('hex'),
    );
    expect(creation.metadata).toBe(metadata);
  });

  it('verifies an initial email transactionally and adds the seeded role', async () => {
    accountTokens.consumeMfaCode.mockResolvedValue({ user, metadata: null });
    await expect(
      service.verifyEmail('v1', '123456', user as never),
    ).resolves.toBe(user);
    expect(accountTokens.consumeMfaCode).toHaveBeenCalledWith(
      'v1',
      AccountTokenType.EMAIL_VERIFICATION,
      '123456',
      {},
      'u1',
      manager,
    );
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({ roles: [{ id: 'role', key: ROLE_KEYS.USER }] }),
    );
  });

  it('rejects mismatched token users and missing seeded roles', async () => {
    accountTokens.consumeMfaCode.mockResolvedValue({
      user: { ...user, id: 'other' },
      metadata: null,
    });
    await expect(
      service.verifyEmail('v1', '123456', user as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    accountTokens.consumeMfaCode.mockResolvedValue({ user, metadata: null });
    roles.findOne.mockResolvedValue(null);
    await expect(
      service.verifyEmail('v1', '123456', user as never),
    ).rejects.toThrow('Account cannot be verified.');
  });

  it('changes email in one transaction, rotates session versions, then sends notice', async () => {
    accountTokens.consumeMfaCode.mockResolvedValue({
      user,
      metadata: { newEmail: 'new@test.dev' },
    });
    users.findOne.mockResolvedValue(null);
    const changed = await service.verifyEmail('v1', '123456', user as never);
    expect(changed.identity.email).toBe('new@test.dev');
    expect(users.save).toHaveBeenCalled();
    expect(query.execute).toHaveBeenCalled();
    expect(emailSvc.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'old@test.dev' }),
    );
  });

  it('rejects malformed metadata, inactive accounts, and email-change collisions', async () => {
    accountTokens.consumeMfaCode.mockResolvedValue({
      user,
      metadata: { newEmail: 42 },
    });
    await expect(
      service.verifyEmail('v', '1', user as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    accountTokens.consumeMfaCode.mockResolvedValue({
      user,
      metadata: { newEmail: 'new@test.dev' },
    });
    userSvc.canAuthenticate.mockReturnValue(false);
    await expect(service.verifyEmail('v', '1', user as never)).rejects.toThrow(
      'Account cannot change email address.',
    );
    userSvc.canAuthenticate.mockReturnValue(true);
    users.findOne.mockResolvedValue({ id: 'other' });
    await expect(
      service.verifyEmail('v', '1', user as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a registration using seeded status/role and sends success after commit', async () => {
    const metadata = {
      email: 'new@test.dev',
      password: 'password-hash',
      profile: { name: { first: 'New' } },
    };
    registrationTokens.consumeVerificationCode.mockResolvedValue({ metadata });
    users.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await expect(
      service.verifyRegistrationToken('r1', '123456'),
    ).resolves.toEqual(expect.objectContaining({ id: 'new-user' }));
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: { email: 'new@test.dev', password: 'password-hash' },
        status: expect.objectContaining({ key: ACCOUNT_STATUS_KEYS.ACTIVE }),
        roles: [expect.objectContaining({ key: ROLE_KEYS.USER })],
      }),
    );
    expect(emailSvc.sendEmail).toHaveBeenCalled();
  });

  it.each([
    ['duplicate email', 'duplicate'],
    ['missing status', 'status'],
    ['missing role', 'role'],
  ])(
    'rolls back registration and sends no success email for %s',
    async (_label, failure) => {
      const metadata = {
        email: 'new@test.dev',
        password: 'hash',
        profile: { name: { first: 'New' } },
      };
      registrationTokens.consumeVerificationCode.mockResolvedValue({
        metadata,
      });
      users.findOne.mockResolvedValue(failure === 'duplicate' ? user : null);
      if (failure === 'status') statuses.findOne.mockResolvedValue(null);
      if (failure === 'role') roles.findOne.mockResolvedValue(null);
      await expect(
        service.verifyRegistrationToken('r1', '123456'),
      ).rejects.toBeInstanceOf(
        failure === 'duplicate' ? ConflictException : BadRequestException,
      );
      expect(users.save).not.toHaveBeenCalled();
      expect(emailSvc.sendEmail).not.toHaveBeenCalled();
    },
  );
});
