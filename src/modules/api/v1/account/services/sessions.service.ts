import { Response } from 'express';
import { Injectable, NotFoundException } from '@nestjs/common';

import {
  AuditActorType,
  AuditEventDomain,
  AuditResourceType,
  AuditSource,
  AuditSubjectType,
  AUDIT_EVENT_MATRIX,
} from '@/config/audit-events.config';

import { identitySessionSnapshot } from '@/modules/domain/audit/snapshots/identity-audit.snapshot';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { SessionDto } from '@/modules/domain/identity/models/user.model';
import { AuditService } from '@/modules/domain/audit/services/audit.service';

@Injectable()
export class SessionsApiService {
  public constructor(
    private readonly refreshSvc: RefreshService,
    private readonly auditSvc: AuditService,
  ) {}

  public async findAll(user: UserEntity): Promise<SessionDto[]> {
    const sessions = await this.refreshSvc.findSessions(user.id);
    return sessions.map((session) => new SessionDto(session));
  }

  public async revoke(
    user: UserEntity,
    currentSession: UserSessionEntity,
    sessionId: string,
    res: Response,
  ): Promise<void> {
    const target =
      currentSession.id === sessionId
        ? currentSession
        : await this.refreshSvc.findSessionById(user.id, sessionId);

    if (!target) throw new NotFoundException('Session not found.');

    const before = identitySessionSnapshot(target, user.id);

    if (currentSession.id === sessionId) {
      await this.refreshSvc.revokeTokens(currentSession, res);
    } else {
      await this.refreshSvc.revokeSessionById(user.id, sessionId);
    }

    await this.auditSvc.record({
      event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].SESSION_REVOKED,
      domain: AuditEventDomain.IDENTITY,
      actorType: AuditActorType.USER,
      actorId: user.id,
      subjectType: AuditSubjectType.USER,
      subjectId: user.id,
      resourceType: AuditResourceType.IDENTITY_SESSION,
      resourceId: sessionId,
      sessionId: currentSession.id,
      source: AuditSource.HTTP,
      metadata: {},
      before,
      after: { ...before, active: false },
    });
  }

  public async revokeAll(user: UserEntity, res: Response): Promise<void> {
    const sessionIds = (await this.refreshSvc.findSessions(user.id)).map(
      ({ id }) => id,
    );

    const before = { id: user.id, sessions: [...sessionIds] };
    await this.refreshSvc.revokeAllSessions(user.id, res);

    const remainingSessionIds = (
      await this.refreshSvc.findSessions(user.id)
    ).map(({ id }) => id);

    await this.auditSvc.record({
      event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].ALL_SESSIONS_REVOKED,
      domain: AuditEventDomain.IDENTITY,
      actorType: AuditActorType.USER,
      actorId: user.id,
      subjectType: AuditSubjectType.USER,
      subjectId: user.id,
      resourceType: AuditResourceType.IDENTITY_USER,
      resourceId: user.id,
      source: AuditSource.HTTP,
      metadata: {},
      before,
      after: { id: user.id, sessions: remainingSessionIds },
    });
  }
}
