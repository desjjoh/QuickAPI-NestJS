jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
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
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';
import {
  AUDIT_EVENT_MATRIX,
  AuditEventDomain,
} from '@/config/audit-events.config';

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
      verifyEmail: jest.fn().mockResolvedValue(user),
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
      record: jest.fn().mockResolvedValue({}),
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
    const { service, userSvc, evSvc, auditSvc } = setup();
    const currentUser = userFixture({
      identity: { ...user.identity, email: 'current@example.test' },
    });
    await expect(
      service.updateEmail(currentUser, {
        password: 'old',
        email: 'replacement@example.test',
      }),
    ).resolves.toEqual({
      challenge_id: 'email-challenge',
      method: MfaMethod.EMAIL_OTP,
      expires_at: new Date('2026-02-01'),
    });
    expect(userSvc.validateUser).toHaveBeenCalledWith(
      'current@example.test',
      'old',
    );
    expect(evSvc.sendEmailChangeVerification).toHaveBeenCalledWith(
      currentUser,
      'replacement@example.test',
    );
    expect(auditSvc.record).not.toHaveBeenCalled();
  });

  it('rejects requesting the current email without validating or sending', async () => {
    const { service, userSvc, evSvc } = setup();
    const currentUser = userFixture({
      identity: { ...user.identity, email: 'current@example.test' },
    });

    await expect(
      service.updateEmail(currentUser, {
        password: 'old',
        email: ' CURRENT@EXAMPLE.TEST ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userSvc.validateUser).not.toHaveBeenCalled();
    expect(evSvc.sendEmailChangeVerification).not.toHaveBeenCalled();
  });

  it('audits a completed email change before issuing replacement tokens', async () => {
    const { service, evSvc, refreshSvc, auditSvc } = setup();
    const updated = userFixture({
      id: user.id,
      identity: { ...user.identity, email: 'new@example.test' },
    });
    evSvc.verifyEmail.mockResolvedValue(updated);

    await service.confirmEmail(
      user,
      session,
      { challenge_id: 'email-challenge', code: '123456' },
      res,
    );

    expect(auditSvc.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event:
          AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].EMAIL_CHANGE_COMPLETED,
        sessionId: session.id,
        before: { id: user.id, identity: { email: user.identity.email } },
        after: { id: user.id, identity: { email: 'new@example.test' } },
      }),
    );
    expect(refreshSvc.issueTokens).toHaveBeenCalledWith(updated, res, session);
  });

  it('rejects a confirmation that did not change the email', async () => {
    const { service, evSvc, refreshSvc, auditSvc } = setup();

    await expect(
      service.confirmEmail(
        user,
        session,
        { challenge_id: 'email-challenge', code: '123456' },
        res,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(evSvc.verifyEmail).toHaveBeenCalledWith(
      'email-challenge',
      '123456',
      user,
    );
    expect(auditSvc.record).not.toHaveBeenCalled();
    expect(refreshSvc.issueTokens).not.toHaveBeenCalled();
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
