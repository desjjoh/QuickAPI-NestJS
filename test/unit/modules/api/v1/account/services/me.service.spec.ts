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
import type { UserCredentialsService } from '@/modules/domain/identity/services/user-credentials.service';
import type { UserLifecycleService } from '@/modules/domain/identity/services/user-lifecycle.service';
import type { EmailService } from '@/modules/system/email/services/email.service';
import {
  sessionFixture,
  userFixture,
} from '@/../test/helpers/identity.fixtures';
import { MeApiService } from '@/modules/api/v1/account/services/me.service';
import { TransactionLifecycle } from '@/common/helpers/transaction.helper';
import { AuditRedactionService } from '@/modules/domain/audit/services/audit-redaction.service';
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
    const manager = {
      getRepository: jest.fn(),
      findOneOrFail: jest.fn().mockResolvedValue(user),
    };
    const transactionLifecycle = new TransactionLifecycle();
    const userSvc = {
      transaction: jest.fn((work) => work(manager, transactionLifecycle)),
      updateUser: jest.fn().mockResolvedValue(user),
      findByIdOrFail: jest.fn().mockResolvedValue(user),
    };
    const credentials = {
      validateUser: jest.fn().mockResolvedValue(user),
      updateMetadata: jest.fn().mockResolvedValue(user),
      recordMfaChanged: jest.fn().mockResolvedValue(user),
      hashPassword: jest.fn().mockResolvedValue('new-hash'),
      recordPasswordChanged: jest.fn().mockResolvedValue(user),
    };
    const lifecycle = { deleteUser: jest.fn() };
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
        credentials as unknown as UserCredentialsService,
        lifecycle as unknown as UserLifecycleService,
        refreshSvc as unknown as RefreshService,
        evSvc as unknown as EmailVerificationService,
        emailSvc as unknown as EmailService,
        mfaSvc as unknown as MfaService,
        auditSvc as never,
      ),
      userSvc,
      credentials,
      lifecycle,
      refreshSvc,
      evSvc,
      emailSvc,
      mfaSvc,
      auditSvc,
      manager,
      transactionLifecycle,
    };
  };

  it('validates the password and deletes the account with cookie response', async () => {
    const { service, credentials, lifecycle, auditSvc, transactionLifecycle } =
      setup();
    await service.deleteMe(user, { password: 'old' }, res);
    expect(credentials.validateUser).toHaveBeenCalledWith(
      user.identity.email,
      'old',
      expect.any(Object),
    );
    expect(lifecycle.deleteUser).toHaveBeenCalledWith(
      user,
      expect.any(Object),
      transactionLifecycle,
    );
    expect(auditSvc.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'identity.account.deleted',
        actorId: user.id,
        subjectId: user.id,
        resourceType: 'identity.user',
        resourceId: user.id,
      }),
      expect.any(Object),
    );
  });

  it('does not commit deletion when the subject-preserving audit fails', async () => {
    const { service, userSvc, lifecycle, auditSvc } = setup();
    auditSvc.record.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      service.deleteMe(user, { password: 'old' }, res),
    ).rejects.toThrow('audit unavailable');

    expect(userSvc.transaction).toHaveBeenCalledTimes(1);
    expect(lifecycle.deleteUser).toHaveBeenCalledTimes(1);
    expect(auditSvc.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'identity.account.deleted',
        subjectId: user.id,
        resourceId: user.id,
      }),
      expect.any(Object),
    );
  });

  it('captures a fresh locked before value and reloads the persisted tombstone', async () => {
    const { service, manager, auditSvc } = setup();
    const fresh = userFixture({
      id: 'deleted-user',
      profile: { name: { first: 'Fresh' } },
    });
    const deletedAt = new Date('2026-10-11T12:00:00.123Z');
    const after = userFixture({
      id: fresh.id,
      identity: { email: 'deleted-internal@users.invalid', password: null },
      status: { key: 'deleted' },
      metadata: { deleted_at: deletedAt },
    });
    manager.findOneOrFail
      .mockResolvedValueOnce(fresh)
      .mockResolvedValueOnce(after);
    await service.deleteMe(
      userFixture({ id: fresh.id }),
      { password: 'old' },
      res,
    );
    expect(manager.findOneOrFail).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      { where: { id: fresh.id }, lock: { mode: 'pessimistic_write' } },
    );
    expect(auditSvc.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: fresh.id,
        subjectId: fresh.id,
        includeSnapshotContext: true,
        before: expect.objectContaining({
          profile: expect.objectContaining({
            name: { first: 'Fresh', last: fresh.profile.name.last },
          }),
        }),
        after: expect.objectContaining({
          status: expect.objectContaining({ key: 'deleted' }),
          metadata: expect.objectContaining({
            deleted_at: deletedAt.toISOString(),
          }),
        }),
      }),
      manager,
    );
  });

  it('disables MFA and synchronizes user metadata', async () => {
    const { service, credentials, mfaSvc, auditSvc } = setup();
    await expect(
      service.updateMfa(user, { password: 'old', enabled: false }),
    ).resolves.toBeUndefined();
    expect(mfaSvc.disable).toHaveBeenCalledWith(user);
    expect(credentials.recordMfaChanged).toHaveBeenCalledWith(user, false);
    expect(auditSvc.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'identity.mfa.disabled',
        actorId: user.id,
        subjectId: user.id,
        resourceId: user.id,
      }),
    );
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
    const { service, credentials, refreshSvc, mfaSvc, auditSvc } = setup();
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
    expect(credentials.recordMfaChanged).toHaveBeenCalledWith(user, true);
    expect(refreshSvc.revokeOtherSessions).toHaveBeenCalledWith(
      user.id,
      session.id,
    );
    expect(auditSvc.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'identity.mfa.enabled',
        actorId: user.id,
        subjectId: user.id,
        resourceId: user.id,
        sessionId: session.id,
      }),
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
    const { service, credentials, evSvc, auditSvc } = setup();
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
    expect(credentials.validateUser).toHaveBeenCalledWith(
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
    const { service, credentials, evSvc } = setup();
    const currentUser = userFixture({
      identity: { ...user.identity, email: 'current@example.test' },
    });

    await expect(
      service.updateEmail(currentUser, {
        password: 'old',
        email: ' CURRENT@EXAMPLE.TEST ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(credentials.validateUser).not.toHaveBeenCalled();
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
        before: expect.objectContaining({
          identity: { email: user.identity.email },
        }),
        after: expect.objectContaining({
          identity: { email: updated.identity.email },
        }),
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
    const { service, userSvc, credentials, refreshSvc, emailSvc, auditSvc } =
      setup();
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
    expect(credentials.hashPassword).toHaveBeenCalledWith('NewPassword1!');
    expect(userSvc.updateUser).toHaveBeenCalledWith(user, {
      identity: { password: 'new-hash' },
    });
    expect(credentials.recordPasswordChanged).toHaveBeenCalledWith(user);
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
    expect(auditSvc.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'identity.password.changed',
        actorId: user.id,
        subjectId: user.id,
        resourceId: user.id,
        sessionId: session.id,
        before: expect.objectContaining({
          id: user.id,
          metadata: expect.objectContaining({ last_changed_password: null }),
        }),
        after: expect.objectContaining({ id: user.id }),
      }),
    );
  });

  it('passes changed facts to the catalog without leaking credential inputs', async () => {
    const { service, evSvc, auditSvc } = setup();
    const updated = userFixture({
      id: user.id,
      identity: { ...user.identity, email: 'new-secret@example.test' },
    });
    evSvc.verifyEmail.mockResolvedValue(updated);

    await service.confirmEmail(
      user,
      session,
      { challenge_id: 'private-challenge', code: '654321' },
      res,
    );

    const input = auditSvc.record.mock.calls[0][0];
    const serialized = JSON.stringify(
      new AuditRedactionService().redactDiff(
        input.resourceType,
        input.before,
        input.after,
      ),
    );
    expect(serialized).toContain('[CHANGED]');
    expect(serialized).not.toContain(user.identity.email);
    expect(serialized).not.toContain('new-secret@example.test');
    expect(serialized).not.toContain('private-challenge');
    expect(serialized).not.toContain('654321');
  });
});
