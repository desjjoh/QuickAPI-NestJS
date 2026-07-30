jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import type { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';
import {
  MfaChallengePurpose,
  MfaMethod,
} from '@/modules/domain/identity/entities/mfa.entity';
import type { MfaService } from '@/modules/domain/identity/services/mfa.service';
import type { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import type { UserService } from '@/modules/domain/identity/services/user.service';
import type { EmailService } from '@/modules/system/email/services/email.service';
import {
  sessionFixture,
  userFixture,
} from '@/../test/helpers/identity.fixtures';
import { MeApiService } from './me.service';

describe('MeApiService', () => {
  const user = userFixture();
  const session = sessionFixture();
  const res = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;
  const setup = () => {
    const userSvc = {
      validateUser: jest.fn().mockResolvedValue(user),
      deleteUser: jest.fn(),
      updateMetadata: jest.fn().mockResolvedValue(user),
      hashPassword: jest.fn().mockResolvedValue('new-hash'),
      updateUser: jest.fn().mockResolvedValue(user),
      recordPasswordChanged: jest.fn().mockResolvedValue(user),
    };
    const refreshSvc = {
      revokeOtherSessions: jest.fn(),
      issueTokens: jest.fn().mockResolvedValue({ access_token: 'new-token' }),
    };
    const evSvc = {
      sendEmailChangeVerification: jest.fn().mockResolvedValue({
        id: 'email-challenge',
        expires_at: new Date('2026-02-01'),
      }),
    };
    const emailSvc = { sendEmail: jest.fn() };
    const mfaSvc = {
      disable: jest.fn(),
      requestEnable: jest.fn().mockResolvedValue({
        id: 'mfa-challenge',
        expires_at: new Date('2026-02-01'),
      }),
      verifyChallenge: jest.fn().mockResolvedValue(user),
      enable: jest.fn(),
    };
    const auditSvc = {
      recordActivity: jest.fn().mockResolvedValue({}),
      recordEntityChange: jest.fn().mockResolvedValue({}),
    };
    return {
      service: new MeApiService(
        userSvc as unknown as UserService,
        refreshSvc as unknown as RefreshService,
        evSvc as unknown as EmailVerificationService,
        emailSvc as unknown as EmailService,
        mfaSvc as unknown as MfaService,
        auditSvc as never,
      ),
      userSvc,
      refreshSvc,
      evSvc,
      emailSvc,
      mfaSvc,
      auditSvc,
    };
  };

  it('validates the password and deletes the account with cookie response', async () => {
    const { service, userSvc } = setup();
    await service.deleteMe(user, { password: 'old' }, res);
    expect(userSvc.validateUser).toHaveBeenCalledWith(
      user.identity.email,
      'old',
    );
    expect(userSvc.deleteUser).toHaveBeenCalledWith(user, res);
  });

  it('disables MFA and synchronizes user metadata', async () => {
    const { service, userSvc, mfaSvc } = setup();
    await expect(
      service.updateMfa(user, { password: 'old', enabled: false }),
    ).resolves.toBeUndefined();
    expect(mfaSvc.disable).toHaveBeenCalledWith(user);
    expect(userSvc.updateMetadata).toHaveBeenCalledWith(user, {
      mfa_enabled: false,
    });
  });

  it('requests MFA enablement and returns the challenge DTO', async () => {
    const { service, mfaSvc } = setup();
    await expect(
      service.updateMfa(user, { password: 'old', enabled: true }),
    ).resolves.toEqual({
      mfa_required: true,
      challenge_id: 'mfa-challenge',
      method: MfaMethod.EMAIL_OTP,
      expires_at: new Date('2026-02-01'),
    });
    expect(mfaSvc.requestEnable).toHaveBeenCalledWith(user);
  });

  it('confirms MFA and protects the current session while revoking others', async () => {
    const { service, userSvc, refreshSvc, mfaSvc } = setup();
    await service.confirmMfa(user, session, {
      challenge_id: 'mfa-challenge',
      code: '123456',
    });
    expect(mfaSvc.verifyChallenge).toHaveBeenCalledWith(
      'mfa-challenge',
      '123456',
      MfaChallengePurpose.ENABLE,
      user.id,
    );
    expect(mfaSvc.enable).toHaveBeenCalledWith(user);
    expect(userSvc.updateMetadata).toHaveBeenCalledWith(user, {
      mfa_enabled: true,
    });
    expect(refreshSvc.revokeOtherSessions).toHaveBeenCalledWith(
      user.id,
      session.id,
    );
  });

  it('rejects a challenge belonging to another user', async () => {
    const { service, mfaSvc } = setup();
    mfaSvc.verifyChallenge.mockResolvedValue(userFixture({ id: 'other' }));
    await expect(
      service.confirmMfa(user, session, {
        challenge_id: 'bad',
        code: '123456',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(mfaSvc.enable).not.toHaveBeenCalled();
  });

  it('validates an email change and returns its verification DTO', async () => {
    const { service, userSvc, evSvc } = setup();
    await expect(
      service.updateEmail(user, { password: 'old', email: 'new@example.test' }),
    ).resolves.toEqual({
      challenge_id: 'email-challenge',
      method: MfaMethod.EMAIL_OTP,
      expires_at: new Date('2026-02-01'),
    });
    expect(userSvc.validateUser).toHaveBeenCalledWith(
      user.identity.email,
      'old',
    );
    expect(evSvc.sendEmailChangeVerification).toHaveBeenCalledWith(
      user,
      'new@example.test',
    );
  });

  it('changes password, revokes other sessions, emails the user, and reissues tokens', async () => {
    const { service, userSvc, refreshSvc, emailSvc } = setup();
    const tokenDto = await service.updatePassword(
      user,
      session,
      {
        password: 'old',
        new_password: 'NewPassword1!',
        confirm: 'NewPassword1!',
      },
      res,
    );
    expect(tokenDto).toEqual({ access_token: 'new-token' });
    expect(userSvc.hashPassword).toHaveBeenCalledWith('NewPassword1!');
    expect(userSvc.updateUser).toHaveBeenCalledWith(user, {
      identity: { password: 'new-hash' },
    });
    expect(userSvc.recordPasswordChanged).toHaveBeenCalledWith(user);
    expect(refreshSvc.revokeOtherSessions).toHaveBeenCalledWith(
      user.id,
      session.id,
    );
    expect(emailSvc.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.identity.email,
        metadata: { userId: user.id },
        model: { firstName: 'P' },
      }),
    );
    expect(refreshSvc.issueTokens).toHaveBeenCalledWith(user, res, session);
  });
});
