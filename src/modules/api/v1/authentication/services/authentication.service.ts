import { Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { MfaService } from '@/modules/domain/identity/services/mfa.service';
import { MfaChallengePurpose } from '@/modules/domain/identity/entities/mfa.entity';
import { MfaMethod } from '@/modules/domain/identity/entities/mfa.entity';
import { MfaChallengeResponseDto } from '../models/mfa.model';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import { IDENTITY_AUDIT_EVENTS } from '@/modules/domain/audit/constants/identity-audit.constants';

@Injectable()
export class AuthService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly refreshSvc: RefreshService,
    private readonly mfaSvc: MfaService,
    private readonly auditSvc: AuditService,
  ) {}

  public async signIn(
    user: UserEntity,
    res: Response,
    req?: Request,
  ): Promise<JWTDto | MfaChallengeResponseDto> {
    const challenge = await this.mfaSvc.createSignInChallenge(user);

    if (challenge) {
      await this.auditSvc.record({
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

      return new MfaChallengeResponseDto({
        challenge_id: challenge.id,
        method: MfaMethod.EMAIL_OTP,
        expires_at: challenge.expires_at,
      });
    }

    return this.completeSignIn(user, res, req);
  }

  public async completeSignIn(
    user: UserEntity,
    res: Response,
    req?: Request,
  ): Promise<JWTDto> {
    const updated = await this.userSvc.recordSignIn(user);
    const tokens = await (req
      ? this.refreshSvc.issueTokens(updated, res, undefined, req)
      : this.refreshSvc.issueTokens(updated, res));

    await this.auditSvc.record({
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

    return tokens;
  }

  public async verifyMfa(
    challengeId: string,
    code: string,
    res: Response,
    req?: Request,
  ): Promise<JWTDto> {
    let user: UserEntity;
    try {
      user = await this.mfaSvc.verifyChallenge(
        challengeId,
        code,
        MfaChallengePurpose.SIGN_IN,
      );
      this.userSvc.assertCanAuthenticate(user);
    } catch (error) {
      await this.auditSvc.record({
        event: IDENTITY_AUDIT_EVENTS.MFA_SIGN_IN_VERIFICATION_FAILED,
        domain: 'identity',
        outcome: 'failed',
        actorType: 'anonymous',
        source: 'http',
        metadata: {},
        failureCode:
          error instanceof Error ? error.constructor.name : 'UnknownError',
      });
      throw error;
    }

    await this.auditSvc.record({
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

    return this.completeSignIn(user, res, req);
  }

  public async verify(
    user: UserEntity,
    res: Response,
    session: UserSessionEntity,
  ): Promise<JWTDto> {
    try {
      const tokens = await this.refreshSvc.issueTokens(user, res, session);

      await this.auditSvc.record({
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

      return tokens;
    } catch (error) {
      await this.auditSvc.record({
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
        failureCode:
          error instanceof Error ? error.constructor.name : 'UnknownError',
      });

      throw error;
    }
  }

  public async signOut(
    session: UserSessionEntity,
    res: Response,
  ): Promise<void> {
    await this.refreshSvc.revokeTokens(session, res);

    await this.auditSvc.record({
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
  }
}
