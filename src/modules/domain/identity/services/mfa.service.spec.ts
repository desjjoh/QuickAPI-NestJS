jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';

import { AccountTokenType } from '@/config/token.config';
import { MfaChallengePurpose, MfaMethod } from '../entities/mfa.entity';
import { MfaService } from './mfa.service';

describe('MfaService', () => {
  const user = {
    id: 'u1',
    identity: { email: 'user@test.dev' },
    profile: { name: { first: 'Ada', preferred: null } },
  };
  const settingsRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const tokenSvc = {
    createToken: jest.fn(),
    consumeMfaCode: jest.fn(),
    revokeActiveTokens: jest.fn(),
  };
  const emailSvc = { sendEmail: jest.fn() };
  let service: MfaService;
  beforeEach(() => {
    jest.clearAllMocks();
    settingsRepo.create.mockImplementation((x) => x);
    tokenSvc.createToken.mockResolvedValue({
      id: 'm1',
      token: 'opaque',
      expires_at: new Date(),
    });
    service = new MfaService(
      settingsRepo as never,
      tokenSvc as never,
      emailSvc as never,
    );
  });

  it('returns null when sign-in MFA is not enabled', async () => {
    settingsRepo.findOne.mockResolvedValue(null);
    await expect(
      service.createSignInChallenge(user as never),
    ).resolves.toBeNull();
  });

  it.each([
    [MfaChallengePurpose.SIGN_IN, true],
    [MfaChallengePurpose.ENABLE, false],
  ])(
    'creates a %s email challenge whose stored code is hashed',
    async (purpose, existing) => {
      settingsRepo.findOne.mockResolvedValue(
        existing
          ? { enabled: true, primary_method: MfaMethod.EMAIL_OTP }
          : null,
      );
      const result = existing
        ? await service.createSignInChallenge(user as never)
        : await service.requestEnable(user as never);
      const creation = tokenSvc.createToken.mock.calls[0][0];
      const code = emailSvc.sendEmail.mock.calls[0][0].model.code;
      expect(result).toEqual(expect.objectContaining({ id: 'm1' }));
      expect(creation.metadata).toEqual({ purpose });
      expect(creation.mfaCodeHash).toBe(
        createHash('sha256').update(code).digest('hex'),
      );
      expect(creation.mfaCodeHash).not.toBe(code);
    },
  );

  it('rejects already enabled enrollment and unsupported methods', async () => {
    settingsRepo.findOne.mockResolvedValue({ enabled: true });
    await expect(service.requestEnable(user as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    settingsRepo.findOne.mockResolvedValue({
      enabled: true,
      primary_method: 'totp',
    });
    await expect(service.createSignInChallenge(user as never)).rejects.toThrow(
      'Unsupported MFA method.',
    );
  });

  it('verifies the exact challenge purpose and optional user', async () => {
    tokenSvc.consumeMfaCode.mockResolvedValue({ user });
    await expect(
      service.verifyChallenge(
        'm1',
        '123456',
        MfaChallengePurpose.SIGN_IN,
        'u1',
      ),
    ).resolves.toBe(user);
    expect(tokenSvc.consumeMfaCode).toHaveBeenCalledWith(
      'm1',
      AccountTokenType.EMAIL_MFA,
      '123456',
      { purpose: MfaChallengePurpose.SIGN_IN },
      'u1',
    );
  });

  it('enables new or existing settings and rejects duplicate enablement', async () => {
    settingsRepo.findOne.mockResolvedValueOnce(null);
    await service.enable(user as never);
    expect(settingsRepo.create).toHaveBeenCalled();
    expect(settingsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        last_verified_at: expect.any(Date),
      }),
    );
    settingsRepo.findOne.mockResolvedValue({ enabled: true });
    await expect(service.enable(user as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('disables MFA and revokes outstanding challenges', async () => {
    settingsRepo.findOne.mockResolvedValue({ id: 'settings', enabled: true });
    await service.disable(user as never);
    expect(settingsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        disabled_at: expect.any(Date),
      }),
    );
    expect(tokenSvc.revokeActiveTokens).toHaveBeenCalledWith(
      'u1',
      AccountTokenType.EMAIL_MFA,
    );
    settingsRepo.findOne.mockResolvedValue(null);
    await expect(service.disable(user as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
