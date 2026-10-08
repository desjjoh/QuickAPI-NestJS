jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';

import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';
import { AccountTokenType } from '@/config/token.config';
import { ROLE_KEYS } from '@/modules/domain/library/seeders/role.seeder';
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
  const manager = {};
  const accountTokens = { createToken: jest.fn(), consumeMfaCode: jest.fn() };
  const registrationTokens = {
    createToken: jest.fn(),
    consumeVerificationCode: jest.fn(),
  };
  const userSvc = {
    transaction: jest.fn(),
    findByEmail: jest.fn(),
    canAuthenticate: jest.fn(),
    addUserRoleByKey: jest.fn(),
    updateUser: jest.fn(),
    incrementTokenVersion: jest.fn(),
    createUser: jest.fn(),
  };
  const emailSvc = { sendEmail: jest.fn() };

  let service: EmailVerificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    userSvc.transaction.mockImplementation(async (work) => work(manager));
    userSvc.findByEmail.mockResolvedValue(null);
    userSvc.canAuthenticate.mockReturnValue(true);
    userSvc.addUserRoleByKey.mockResolvedValue(user);
    userSvc.updateUser.mockResolvedValue({
      ...user,
      identity: { ...user.identity, email: 'new@test.dev' },
    });
    userSvc.createUser.mockResolvedValue({
      ...user,
      id: 'new-user',
      identity: { ...user.identity, email: 'new@test.dev' },
    });
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
    service = new EmailVerificationService(
      accountTokens as never,
      registrationTokens as never,
      userSvc as never,
      userSvc as never,
      userSvc as never,
      userSvc as never,
      userSvc as never,
      emailSvc as never,
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
    expect(userSvc.findByEmail).toHaveBeenCalledWith('new@test.dev');
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
    userSvc.findByEmail.mockResolvedValue({ id: 'other' });
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
    expect(userSvc.addUserRoleByKey).toHaveBeenCalledWith(
      user,
      ROLE_KEYS.USER,
      manager,
    );
  });

  it('rejects a verification token belonging to another user', async () => {
    accountTokens.consumeMfaCode.mockResolvedValue({
      user: { ...user, id: 'other' },
      metadata: null,
    });
    await expect(
      service.verifyEmail('v1', '123456', user as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userSvc.addUserRoleByKey).not.toHaveBeenCalled();
  });

  it('changes email through the service, rotates sessions, then sends notice', async () => {
    accountTokens.consumeMfaCode.mockResolvedValue({
      user,
      metadata: { newEmail: 'new@test.dev' },
    });
    const changed = await service.verifyEmail('v1', '123456', user as never);
    expect(changed.identity.email).toBe('new@test.dev');
    expect(userSvc.findByEmail).toHaveBeenCalledWith('new@test.dev', manager);
    expect(userSvc.updateUser).toHaveBeenCalledWith(
      user,
      expect.objectContaining({
        identity: expect.objectContaining({ email: 'new@test.dev' }),
      }),
      {},
      manager,
    );
    expect(userSvc.incrementTokenVersion).toHaveBeenCalledWith('u1', manager);
    expect(emailSvc.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'old@test.dev' }),
    );
  });

  it('rejects malformed metadata, inactive accounts, and collisions', async () => {
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
    userSvc.findByEmail.mockResolvedValue({ id: 'other' });
    await expect(
      service.verifyEmail('v', '1', user as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a registration through UserService and sends success after commit', async () => {
    const metadata = {
      email: 'new@test.dev',
      password: 'password-hash',
      profile: { name: { first: 'New' } },
    };
    registrationTokens.consumeVerificationCode.mockResolvedValue({ metadata });
    await expect(
      service.verifyRegistrationToken('r1', '123456'),
    ).resolves.toEqual(expect.objectContaining({ id: 'new-user' }));
    expect(userSvc.createUser).toHaveBeenCalledWith(
      {
        identity: {
          email: 'new@test.dev',
          password: 'password-hash',
        },
        profile: metadata.profile,
      },
      manager,
    );
    expect(emailSvc.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'new@test.dev' }),
    );
  });

  it('does not send success when transactional registration fails', async () => {
    registrationTokens.consumeVerificationCode.mockResolvedValue({
      metadata: {
        email: 'new@test.dev',
        password: 'hash',
        profile: { name: { first: 'New' } },
      },
    });
    userSvc.createUser.mockRejectedValue(new ConflictException());
    await expect(
      service.verifyRegistrationToken('r1', '123456'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(emailSvc.sendEmail).not.toHaveBeenCalled();
  });
});
