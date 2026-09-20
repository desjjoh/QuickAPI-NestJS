import { Injectable } from '@nestjs/common';
import { Request, Response } from 'express';

import { RequestContext } from '@/common/store/request-context.store';

import {
  AuditActorType,
  AuditEventDomain,
  AuditResourceType,
  AuditSource,
  AuditSubjectType,
  AUDIT_EVENT_MATRIX,
} from '@/config/audit-events.config';

import { AuditService } from '@/modules/domain/audit/services/audit.service';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { MfaService } from '@/modules/domain/identity/services/mfa.service';
import { MfaChallengePurpose } from '@/modules/domain/identity/entities/mfa.entity';
import { MfaMethod } from '@/modules/domain/identity/entities/mfa.entity';
import {
  identitySessionSnapshot,
  identityUserSnapshot,
} from '@/modules/domain/audit/snapshots/identity-audit.snapshot';

import { MfaChallengeResponseDto } from '../models/mfa.model';

interface CompleteSignInOptions {
  readonly recordAudit?: boolean;
}

@Injectable()
export class AuthService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly refreshSvc: RefreshService,
    private readonly mfaSvc: MfaService,
    private readonly auditSvc: AuditService,
    private readonly requestContext: RequestContext,
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
    options: CompleteSignInOptions = {},
  ): Promise<JWTDto> {
    const before = identityUserSnapshot(user);
    const updated = await this.userSvc.recordSignIn(user);
    const after = identityUserSnapshot(updated);
    const tokens = await (req
      ? this.refreshSvc.issueTokens(updated, res, undefined, req)
      : this.refreshSvc.issueTokens(updated, res));
    const sessionId = tokens.user.session!.id;

    this.requestContext.set('sessionId', sessionId);

    if (options.recordAudit !== false)
      await this.auditSvc.record({
        event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].SIGN_IN_SUCCEEDED,
        domain: AuditEventDomain.IDENTITY,
        actorType: AuditActorType.USER,
        actorId: user.id,
        subjectType: AuditSubjectType.USER,
        subjectId: user.id,
        sessionId,
        resourceType: AuditResourceType.IDENTITY_USER,
        resourceId: user.id,
        source: AuditSource.HTTP,
        metadata: {},
        before,
        after,
        meaningfulWithoutChanges: true,
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
    user: UserEntity,
    session: UserSessionEntity,
    res: Response,
  ): Promise<void> {
    const before = identitySessionSnapshot(session);
    await this.refreshSvc.revokeTokens(session, res);
    const after = { ...before, active: false };

    await this.auditSvc.record({
      event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].SIGN_OUT_COMPLETED,
      domain: AuditEventDomain.IDENTITY,
      actorType: AuditActorType.USER,
      actorId: user.id,
      subjectType: AuditSubjectType.USER,
      subjectId: user.id,
      sessionId: session.id,
      resourceType: AuditResourceType.IDENTITY_SESSION,
      resourceId: session.id,
      source: AuditSource.HTTP,
      metadata: {},
      before,
      after,
    });
  }
}
