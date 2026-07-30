jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import type { Request, Response } from 'express';
import { ForbiddenException } from '@nestjs/common';

import {
  MfaChallengePurpose,
  MfaMethod,
} from '@/modules/domain/identity/entities/mfa.entity';
import type { MfaService } from '@/modules/domain/identity/services/mfa.service';
import type { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import type { UserService } from '@/modules/domain/identity/services/user.service';
import {
  sessionFixture,
  userFixture,
} from '@/../test/helpers/identity.fixtures';

import { AuthService } from './authentication.service';
import { IDENTITY_AUDIT_EVENTS } from '@/modules/domain/audit/constants/identity-audit.constants';

describe('AuthService', () => {
  const res = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;
  const user = userFixture();
  const session = sessionFixture();
  const tokens = {
    access_token: 'access',
    iat: 1,
    exp: 2,
    refresh: 3,
    user: {},
  };

  const setup = () => {
    const userSvc = {
      recordSignIn: jest.fn().mockResolvedValue(user),
      assertCanAuthenticate: jest.fn(),
    };
    const refreshSvc = {
      issueTokens: jest.fn().mockResolvedValue(tokens),
      revokeTokens: jest.fn().mockResolvedValue(undefined),
    };
    const auditSvc = { record: jest.fn().mockResolvedValue({}) };
    const mfaSvc = {
      createSignInChallenge: jest.fn().mockResolvedValue(null),
      verifyChallenge: jest.fn().mockResolvedValue(user),
    };
    return {
      service: new AuthService(
        userSvc as unknown as UserService,
        refreshSvc as unknown as RefreshService,
        mfaSvc as unknown as MfaService,
        auditSvc as never,
      ),
      userSvc,
      refreshSvc,
      mfaSvc,
      auditSvc,
    };
  };

  it('completes an ordinary sign-in and returns the issued token DTO', async () => {
    const { service, userSvc, refreshSvc, auditSvc } = setup();
    await expect(service.signIn(user, res)).resolves.toBe(tokens);
    expect(userSvc.recordSignIn).toHaveBeenCalledWith(user);
    expect(refreshSvc.issueTokens).toHaveBeenCalledWith(user, res);
    expect(auditSvc.record).toHaveBeenCalledWith({
      event: IDENTITY_AUDIT_EVENTS.SIGN_IN_SUCCEEDED,
      domain: 'identity',
      outcome: 'succeeded',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      source: 'http',
      metadata: {},
    });
  });

  it('passes request context when issuing tokens for an ordinary sign-in', async () => {
    const { service, refreshSvc } = setup();
    const req = { ip: '127.0.0.1' } as Request;

    await expect(service.signIn(user, res, req)).resolves.toBe(tokens);

    expect(refreshSvc.issueTokens).toHaveBeenCalledWith(
      user,
      res,
      undefined,
      req,
    );
  });

  it('returns an MFA challenge without recording sign-in or issuing tokens', async () => {
    const { service, userSvc, refreshSvc, mfaSvc, auditSvc } = setup();
    const expires = new Date('2026-02-01T00:00:00Z');
    mfaSvc.createSignInChallenge.mockResolvedValue({
      id: 'challenge-1',
      expires_at: expires,
    });
    await expect(service.signIn(user, res)).resolves.toEqual({
      mfa_required: true,
      challenge_id: 'challenge-1',
      method: MfaMethod.EMAIL_OTP,
      expires_at: expires,
    });
    expect(userSvc.recordSignIn).not.toHaveBeenCalled();
    expect(refreshSvc.issueTokens).not.toHaveBeenCalled();
    expect(auditSvc.record).toHaveBeenCalledWith({
      event: IDENTITY_AUDIT_EVENTS.MFA_SIGN_IN_CHALLENGE_ISSUED,
      domain: 'identity',
      outcome: 'pending',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      source: 'http',
      metadata: {},
    });
  });

  it('verifies and completes the sign-in MFA challenge', async () => {
    const { service, userSvc, refreshSvc, mfaSvc, auditSvc } = setup();
    await expect(service.verifyMfa('challenge-1', '123456', res)).resolves.toBe(
      tokens,
    );
    expect(mfaSvc.verifyChallenge).toHaveBeenCalledWith(
      'challenge-1',
      '123456',
      MfaChallengePurpose.SIGN_IN,
    );
    expect(userSvc.assertCanAuthenticate).toHaveBeenCalledWith(user);
    expect(refreshSvc.issueTokens).toHaveBeenCalledWith(user, res);
    expect(auditSvc.record).toHaveBeenNthCalledWith(1, {
      event: IDENTITY_AUDIT_EVENTS.MFA_SIGN_IN_VERIFICATION_SUCCEEDED,
      domain: 'identity',
      outcome: 'succeeded',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      source: 'http',
      metadata: {},
    });
  });

  it('propagates account-state failures and does not issue tokens', async () => {
    const { service, userSvc, refreshSvc, auditSvc } = setup();
    const error = new ForbiddenException('Account disabled.');
    userSvc.assertCanAuthenticate.mockImplementation(() => {
      throw error;
    });
    await expect(service.verifyMfa('challenge-1', '123456', res)).rejects.toBe(
      error,
    );
    expect(refreshSvc.issueTokens).not.toHaveBeenCalled();
    expect(auditSvc.record).toHaveBeenCalledWith({
      event: IDENTITY_AUDIT_EVENTS.MFA_SIGN_IN_VERIFICATION_FAILED,
      domain: 'identity',
      outcome: 'failed',
      actorType: 'anonymous',
      source: 'http',
      metadata: {},
      failureCode: 'ForbiddenException',
    });
  });

  it('records a safe failure code when MFA verification rejects with a non-error value', async () => {
    const { service, refreshSvc, mfaSvc, auditSvc } = setup();
    mfaSvc.verifyChallenge.mockRejectedValue('verification failed');

    await expect(service.verifyMfa('challenge-1', '123456', res)).rejects.toBe(
      'verification failed',
    );
    expect(refreshSvc.issueTokens).not.toHaveBeenCalled();
    expect(auditSvc.record).toHaveBeenCalledWith(
      expect.objectContaining({ failureCode: 'UnknownError' }),
    );
  });

  it('delegates refresh verification with the existing session', async () => {
    const { service, refreshSvc, auditSvc } = setup();
    await expect(service.verify(user, res, session)).resolves.toBe(tokens);
    expect(refreshSvc.issueTokens).toHaveBeenCalledWith(user, res, session);
    expect(auditSvc.record).toHaveBeenCalledWith({
      event: IDENTITY_AUDIT_EVENTS.REFRESH_SUCCEEDED,
      domain: 'identity',
      outcome: 'succeeded',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      sessionId: session.id,
      source: 'http',
      metadata: {},
    });
  });

  it('revokes the session and clears response cookies on sign-out', async () => {
    const { service, refreshSvc, auditSvc } = setup();
    await expect(service.signOut(session, res)).resolves.toBeUndefined();
    expect(refreshSvc.revokeTokens).toHaveBeenCalledWith(session, res);
    expect(auditSvc.record).toHaveBeenCalledWith({
      event: IDENTITY_AUDIT_EVENTS.SIGN_OUT_COMPLETED,
      domain: 'identity',
      outcome: 'succeeded',
      actorType: 'user',
      sessionId: session.id,
      resourceType: 'session',
      resourceId: session.id,
      source: 'http',
      metadata: {},
    });
  });

  it('records the exact failed refresh event after token issuance fails', async () => {
    const { service, refreshSvc, auditSvc } = setup();
    refreshSvc.issueTokens.mockRejectedValue(new Error('rotation failed'));
    await expect(service.verify(user, res, session)).rejects.toThrow(
      'rotation failed',
    );
    expect(auditSvc.record).toHaveBeenCalledWith({
      event: IDENTITY_AUDIT_EVENTS.REFRESH_FAILED,
      domain: 'identity',
      outcome: 'failed',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      sessionId: session.id,
      source: 'http',
      metadata: {},
      failureCode: 'Error',
    });
  });

  it('records a safe failure code when refresh rejects with a non-error value', async () => {
    const { service, refreshSvc, auditSvc } = setup();
    refreshSvc.issueTokens.mockRejectedValue('rotation failed');

    await expect(service.verify(user, res, session)).rejects.toBe(
      'rotation failed',
    );
    expect(auditSvc.record).toHaveBeenCalledWith(
      expect.objectContaining({ failureCode: 'UnknownError' }),
    );
  });
});
