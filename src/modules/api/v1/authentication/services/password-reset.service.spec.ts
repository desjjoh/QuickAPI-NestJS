jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { createHash } from 'crypto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { AccountTokenType } from '@/config/token.config';
import {
  PasswordResetChallengeState,
  PasswordResetService,
} from './password-reset.service';

describe('PasswordResetService', () => {
  const user = {
    id: 'u1',
    identity: { email: 'user@test.dev' },
    profile: { name: { first: 'Ada', preferred: null } },
  };
  const tokenSvc = {
    createToken: jest.fn(),
    authorizeMfaCode: jest.fn(),
    consumeToken: jest.fn(),
  };
  const emailSvc = { sendEmail: jest.fn() };
  const userRepo = {
    findByEmail: jest.fn(),
    revokeAllSessions: jest.fn(),
    manager: { find: jest.fn().mockResolvedValue([]) },
  };
  const userSvc = {
    canAuthenticate: jest.fn(),
    assertCanAuthenticate: jest.fn(),
    hashPassword: jest.fn(),
    updateUser: jest.fn(),
    recordPasswordChanged: jest.fn(),
  };
  const auditSvc = {
    record: jest.fn().mockResolvedValue({}),
  };
  let service: PasswordResetService;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo.findByEmail.mockResolvedValue(user);
    userSvc.canAuthenticate.mockReturnValue(true);
    tokenSvc.createToken.mockResolvedValue({
      id: 't1',
      token: 'opaque',
      expires_at: new Date(),
    });
    service = new PasswordResetService(
      tokenSvc as never,
      emailSvc as never,
      userRepo as never,
      userSvc as never,
      auditSvc as never,
    );
  });

  it('requests a reset with a hashed six-digit code and emails only the plaintext boundary value', async () => {
    await service.requestPasswordReset('user@test.dev');
    const creation = tokenSvc.createToken.mock.calls[0][0];
    const code = emailSvc.sendEmail.mock.calls[0][0].model.code;
    expect(code).toMatch(/^\d{6}$/);
    expect(creation).toEqual(
      expect.objectContaining({
        user,
        type: AccountTokenType.PASSWORD_RESET,
        metadata: { state: PasswordResetChallengeState.PENDING },
      }),
    );
    expect(creation.mfaCodeHash).toBe(
      createHash('sha256').update(code).digest('hex'),
    );
    expect(creation.mfaCodeHash).not.toBe(code);
  });

  it.each([
    ['unknown', null, true],
    ['inactive', user, false],
  ])('silently ignores an %s account', async (_label, found, active) => {
    userRepo.findByEmail.mockResolvedValue(found);
    userSvc.canAuthenticate.mockReturnValue(active);
    await service.requestPasswordReset('x@test.dev');
    expect(tokenSvc.createToken).not.toHaveBeenCalled();
    expect(emailSvc.sendEmail).not.toHaveBeenCalled();
  });

  it('authorizes a correctly purposed reset code', async () => {
    const authorized = {
      id: 't1',
      token: 'authorization',
      expires_at: new Date(),
    };
    tokenSvc.authorizeMfaCode.mockResolvedValue(authorized);
    await expect(
      service.verifyPasswordResetCode('user@test.dev', '123456'),
    ).resolves.toBe(authorized);
    expect(tokenSvc.authorizeMfaCode).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingMetadata: { state: 'pending' },
        verifiedMetadata: { state: 'verified' },
      }),
    );
  });

  it.each([
    ['missing', null, true],
    ['inactive', user, false],
  ])('rejects verification for a %s account', async (_label, found, active) => {
    userRepo.findByEmail.mockResolvedValue(found);
    userSvc.canAuthenticate.mockReturnValue(active);
    await expect(
      service.verifyPasswordResetCode('x', '123456'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('consumes the authorization, hashes the password, records metadata, and revokes every session', async () => {
    tokenSvc.consumeToken.mockResolvedValue({ user });
    userSvc.hashPassword.mockResolvedValue('password-hash');
    await service.confirmPasswordReset('t1', 'authorization', 'new-password');
    expect(tokenSvc.consumeToken).toHaveBeenCalledWith(
      't1',
      AccountTokenType.PASSWORD_RESET,
      'authorization',
      { state: 'verified' },
      { state: 'consumed' },
    );
    expect(userSvc.hashPassword).toHaveBeenCalledWith('new-password');
    expect(userSvc.updateUser).toHaveBeenCalledWith(user, {
      identity: { password: 'password-hash' },
    });
    expect(userSvc.recordPasswordChanged).toHaveBeenCalledWith(user);
    expect(userRepo.revokeAllSessions).toHaveBeenCalledWith('u1');
    expect(emailSvc.sendEmail).toHaveBeenCalled();
  });

  it('rejects an inactive account without changing a password or revoking sessions', async () => {
    tokenSvc.consumeToken.mockResolvedValue({ user });
    userSvc.assertCanAuthenticate.mockImplementation(() => {
      throw new ForbiddenException();
    });
    await expect(
      service.confirmPasswordReset('t1', 'authorization', 'new'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userSvc.hashPassword).not.toHaveBeenCalled();
    expect(userRepo.revokeAllSessions).not.toHaveBeenCalled();
  });
});
