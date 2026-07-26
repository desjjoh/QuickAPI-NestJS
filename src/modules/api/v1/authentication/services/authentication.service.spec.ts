jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import type { Response } from 'express';
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
    const mfaSvc = {
      createSignInChallenge: jest.fn().mockResolvedValue(null),
      verifyChallenge: jest.fn().mockResolvedValue(user),
    };
    return {
      service: new AuthService(
        userSvc as unknown as UserService,
        refreshSvc as unknown as RefreshService,
        mfaSvc as unknown as MfaService,
      ),
      userSvc,
      refreshSvc,
      mfaSvc,
    };
  };

  it('completes an ordinary sign-in and returns the issued token DTO', async () => {
    const { service, userSvc, refreshSvc } = setup();
    await expect(service.signIn(user, res)).resolves.toBe(tokens);
    expect(userSvc.recordSignIn).toHaveBeenCalledWith(user);
    expect(refreshSvc.issueTokens).toHaveBeenCalledWith(user, res);
  });

  it('returns an MFA challenge without recording sign-in or issuing tokens', async () => {
    const { service, userSvc, refreshSvc, mfaSvc } = setup();
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
  });

  it('verifies and completes the sign-in MFA challenge', async () => {
    const { service, userSvc, refreshSvc, mfaSvc } = setup();
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
  });

  it('propagates account-state failures and does not issue tokens', async () => {
    const { service, userSvc, refreshSvc } = setup();
    const error = new ForbiddenException('Account disabled.');
    userSvc.assertCanAuthenticate.mockImplementation(() => {
      throw error;
    });
    await expect(service.verifyMfa('challenge-1', '123456', res)).rejects.toBe(
      error,
    );
    expect(refreshSvc.issueTokens).not.toHaveBeenCalled();
  });

  it('delegates refresh verification with the existing session', async () => {
    const { service, refreshSvc } = setup();
    await expect(service.verify(user, res, session)).resolves.toBe(tokens);
    expect(refreshSvc.issueTokens).toHaveBeenCalledWith(user, res, session);
  });

  it('revokes the session and clears response cookies on sign-out', async () => {
    const { service, refreshSvc } = setup();
    await expect(service.signOut(session, res)).resolves.toBeUndefined();
    expect(refreshSvc.revokeTokens).toHaveBeenCalledWith(session, res);
  });
});
