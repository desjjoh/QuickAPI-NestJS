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
import {
  AUDIT_EVENT_MATRIX,
  AuditEventDomain,
} from '@/config/audit-events.config';

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

    if (challenge)
      return new MfaChallengeResponseDto({
        challenge_id: challenge.id,
        method: MfaMethod.EMAIL_OTP,
        expires_at: challenge.expires_at,
      });

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
      event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].SIGN_IN_SUCCEEDED,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'succeeded',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'identity.user',
      resourceId: user.id,
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
    const user = await this.mfaSvc.verifyChallenge(
      challengeId,
      code,
      MfaChallengePurpose.SIGN_IN,
    );

    this.userSvc.assertCanAuthenticate(user);

    return this.completeSignIn(user, res, req);
  }

  public async verify(
    user: UserEntity,
    res: Response,
    session: UserSessionEntity,
  ): Promise<JWTDto> {
    return this.refreshSvc.issueTokens(user, res, session);
  }

  public async signOut(
    session: UserSessionEntity,
    res: Response,
  ): Promise<void> {
    await this.refreshSvc.revokeTokens(session, res);

    await this.auditSvc.record({
      event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].SIGN_OUT_COMPLETED,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'succeeded',
      actorType: 'user',
      actorId: session.user?.id ?? null,
      subjectType: 'user',
      subjectId: session.user?.id ?? null,
      sessionId: session.id,
      resourceType: 'identity.session',
      resourceId: session.id,
      source: 'http',
      metadata: {},
    });
  }
}
